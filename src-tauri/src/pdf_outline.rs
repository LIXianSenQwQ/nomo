use std::collections::{HashMap, HashSet};
use std::path::Path;

use lopdf::{text_string, Dictionary, Document, Object, ObjectId};

use crate::models::PdfOutlineEntry;

struct MarkerPosition {
    page_id: ObjectId,
    top: f32,
}

enum AnnotationContainer {
    Direct(ObjectId),
    Indirect(ObjectId),
}

struct AnnotationUpdate {
    container: AnnotationContainer,
    annotations: Vec<Object>,
}

struct OutlineNode {
    parent: Option<usize>,
    children: Vec<usize>,
    page_id: ObjectId,
    top: f32,
}

pub(crate) fn validate_pdf(path: &Path) -> Result<(), String> {
    let bytes = std::fs::read(path).map_err(|error| format!("读取 PDF 失败：{error}"))?;
    if bytes.len() < 5 || !bytes.starts_with(b"%PDF-") {
        return Err("文件缺少有效的 PDF 文件头".to_string());
    }

    let document = Document::load(path).map_err(|error| format!("解析 PDF 失败：{error}"))?;
    if document.get_pages().is_empty() {
        return Err("PDF 不包含页面".to_string());
    }
    Ok(())
}

pub(crate) fn add_document_outline(
    input_path: &Path,
    output_path: &Path,
    entries: &[PdfOutlineEntry],
) -> Result<(), String> {
    if entries.is_empty() {
        return Err("没有可生成的文档标题".to_string());
    }

    validate_outline_entries(entries)?;
    let expected_markers: HashSet<&str> = entries
        .iter()
        .map(|entry| entry.marker_uri.as_str())
        .collect();
    let mut document =
        Document::load(input_path).map_err(|error| format!("解析 PDF 失败：{error}"))?;
    let (positions, updates) = collect_marker_positions(&document, &expected_markers)?;

    if positions.len() != entries.len() {
        return Err(format!(
            "标题定位标记数量不匹配：expected={} actual={}",
            entries.len(),
            positions.len()
        ));
    }

    apply_annotation_updates(&mut document, updates)?;
    build_outline_tree(&mut document, entries, &positions)?;
    document
        .save(output_path)
        .map_err(|error| format!("写入带书签 PDF 失败：{error}"))?;
    validate_pdf(output_path)?;
    Ok(())
}

fn validate_outline_entries(entries: &[PdfOutlineEntry]) -> Result<(), String> {
    let mut markers = HashSet::new();
    for entry in entries {
        if entry.title.trim().is_empty() {
            return Err("文档标题不能为空".to_string());
        }
        if !(1..=6).contains(&entry.level) {
            return Err(format!("无效的标题级别：{}", entry.level));
        }
        if !entry
            .marker_uri
            .starts_with("https://nomo-pdf-outline.invalid/")
        {
            return Err("文档标题包含无效的定位标记".to_string());
        }
        if !markers.insert(entry.marker_uri.as_str()) {
            return Err("文档标题定位标记重复".to_string());
        }
    }
    Ok(())
}

fn collect_marker_positions(
    document: &Document,
    expected_markers: &HashSet<&str>,
) -> Result<(HashMap<String, MarkerPosition>, Vec<AnnotationUpdate>), String> {
    let mut positions = HashMap::new();
    let mut updates = Vec::new();

    for (_page_number, page_id) in document.get_pages() {
        let page = document
            .get_dictionary(page_id)
            .map_err(|error| format!("读取 PDF 页面失败：{error}"))?;
        let annots_object = match page.get(b"Annots") {
            Ok(value) => value.clone(),
            Err(_) => continue,
        };
        let container = match annots_object {
            Object::Reference(id) => AnnotationContainer::Indirect(id),
            _ => AnnotationContainer::Direct(page_id),
        };
        let (_, resolved_annots) = document
            .dereference(&annots_object)
            .map_err(|error| format!("读取 PDF 页面注解失败：{error}"))?;
        let annotations = resolved_annots
            .as_array()
            .map_err(|error| format!("PDF 页面注解格式无效：{error}"))?;
        let mut filtered = Vec::with_capacity(annotations.len());
        let mut changed = false;

        for annotation in annotations {
            let marker = marker_from_annotation(document, annotation)?;
            if let Some((marker_uri, top)) = marker {
                if expected_markers.contains(marker_uri.as_str()) {
                    if positions
                        .insert(marker_uri, MarkerPosition { page_id, top })
                        .is_some()
                    {
                        return Err("同一个标题定位标记在 PDF 中出现多次".to_string());
                    }
                    changed = true;
                    continue;
                }
            }
            filtered.push(annotation.clone());
        }

        if changed {
            updates.push(AnnotationUpdate {
                container,
                annotations: filtered,
            });
        }
    }

    Ok((positions, updates))
}

fn marker_from_annotation(
    document: &Document,
    annotation: &Object,
) -> Result<Option<(String, f32)>, String> {
    let (_, annotation) = document
        .dereference(annotation)
        .map_err(|error| format!("读取 PDF 链接注解失败：{error}"))?;
    let dictionary = match annotation.as_dict() {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };
    if dictionary.get(b"Subtype").and_then(Object::as_name).ok() != Some(b"Link") {
        return Ok(None);
    }

    let action = match dictionary.get(b"A") {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };
    let (_, action) = document
        .dereference(action)
        .map_err(|error| format!("读取 PDF 链接动作失败：{error}"))?;
    let action = match action.as_dict() {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };
    if action.get(b"S").and_then(Object::as_name).ok() != Some(b"URI") {
        return Ok(None);
    }
    let marker_uri = match action.get(b"URI").and_then(Object::as_str) {
        Ok(value) => String::from_utf8_lossy(value).into_owned(),
        Err(_) => return Ok(None),
    };
    if !marker_uri.starts_with("https://nomo-pdf-outline.invalid/") {
        return Ok(None);
    }

    let rect = dictionary
        .get(b"Rect")
        .and_then(Object::as_array)
        .map_err(|error| format!("PDF 标题定位区域无效：{error}"))?;
    if rect.len() != 4 {
        return Err("PDF 标题定位区域长度无效".to_string());
    }
    let y1 = rect[1]
        .as_float()
        .map_err(|error| format!("PDF 标题定位坐标无效：{error}"))?;
    let y2 = rect[3]
        .as_float()
        .map_err(|error| format!("PDF 标题定位坐标无效：{error}"))?;
    Ok(Some((marker_uri, y1.max(y2))))
}

fn apply_annotation_updates(
    document: &mut Document,
    updates: Vec<AnnotationUpdate>,
) -> Result<(), String> {
    for update in updates {
        match update.container {
            AnnotationContainer::Direct(page_id) => {
                let page = document
                    .get_dictionary_mut(page_id)
                    .map_err(|error| format!("更新 PDF 页面注解失败：{error}"))?;
                if update.annotations.is_empty() {
                    page.remove(b"Annots");
                } else {
                    page.set("Annots", Object::Array(update.annotations));
                }
            }
            AnnotationContainer::Indirect(array_id) => {
                let annotations = document
                    .get_object_mut(array_id)
                    .and_then(Object::as_array_mut)
                    .map_err(|error| format!("更新 PDF 间接注解数组失败：{error}"))?;
                *annotations = update.annotations;
            }
        }
    }
    Ok(())
}

fn build_outline_tree(
    document: &mut Document,
    entries: &[PdfOutlineEntry],
    positions: &HashMap<String, MarkerPosition>,
) -> Result<(), String> {
    let mut nodes = Vec::with_capacity(entries.len());
    let mut hierarchy_stack: Vec<(u8, usize)> = Vec::new();

    for (index, entry) in entries.iter().enumerate() {
        while hierarchy_stack
            .last()
            .is_some_and(|(level, _)| *level >= entry.level)
        {
            hierarchy_stack.pop();
        }
        let parent = hierarchy_stack.last().map(|(_, index)| *index);
        let position = positions
            .get(&entry.marker_uri)
            .ok_or_else(|| "缺少 PDF 标题定位信息".to_string())?;
        nodes.push(OutlineNode {
            parent,
            children: Vec::new(),
            page_id: position.page_id,
            top: position.top,
        });
        if let Some(parent) = parent {
            nodes[parent].children.push(index);
        }
        hierarchy_stack.push((entry.level, index));
    }

    let root_items: Vec<usize> = nodes
        .iter()
        .enumerate()
        .filter_map(|(index, node)| node.parent.is_none().then_some(index))
        .collect();
    let outline_root_id = document.new_object_id();
    let item_ids: Vec<ObjectId> = (0..entries.len())
        .map(|_| document.new_object_id())
        .collect();

    for (index, entry) in entries.iter().enumerate() {
        let node = &nodes[index];
        let siblings = node
            .parent
            .map(|parent| nodes[parent].children.as_slice())
            .unwrap_or(root_items.as_slice());
        let sibling_index = siblings
            .iter()
            .position(|value| *value == index)
            .ok_or_else(|| "PDF 书签层级关系无效".to_string())?;
        let mut item = Dictionary::new();
        item.set("Title", text_string(&entry.title));
        item.set(
            "Parent",
            node.parent
                .map(|parent| item_ids[parent])
                .unwrap_or(outline_root_id),
        );
        item.set(
            "Dest",
            Object::Array(vec![
                Object::Reference(node.page_id),
                Object::Name(b"XYZ".to_vec()),
                Object::Null,
                Object::Real(node.top),
                Object::Null,
            ]),
        );

        if sibling_index > 0 {
            item.set("Prev", item_ids[siblings[sibling_index - 1]]);
        }
        if sibling_index + 1 < siblings.len() {
            item.set("Next", item_ids[siblings[sibling_index + 1]]);
        }
        if let Some(first) = node.children.first() {
            item.set("First", item_ids[*first]);
        }
        if let Some(last) = node.children.last() {
            item.set("Last", item_ids[*last]);
        }
        if !node.children.is_empty() {
            item.set("Count", descendant_count(index, &nodes) as i64);
        }

        document
            .objects
            .insert(item_ids[index], Object::Dictionary(item));
    }

    let mut outline_root = Dictionary::new();
    outline_root.set("Type", Object::Name(b"Outlines".to_vec()));
    outline_root.set("First", item_ids[root_items[0]]);
    outline_root.set("Last", item_ids[*root_items.last().unwrap()]);
    outline_root.set("Count", entries.len() as i64);
    document
        .objects
        .insert(outline_root_id, Object::Dictionary(outline_root));
    document
        .catalog_mut()
        .map_err(|error| format!("读取 PDF 文档目录失败：{error}"))?
        .set("Outlines", outline_root_id);
    Ok(())
}

fn descendant_count(index: usize, nodes: &[OutlineNode]) -> usize {
    nodes[index]
        .children
        .iter()
        .map(|child| 1 + descendant_count(*child, nodes))
        .sum()
}
