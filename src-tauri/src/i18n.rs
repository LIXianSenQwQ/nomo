use tauri::{AppHandle, Runtime};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum InterfaceLocale {
    ZhCn,
    ZhTw,
    EnUs,
    JaJp,
}

pub(crate) fn effective_locale<R: Runtime>(app: &AppHandle<R>) -> InterfaceLocale {
    let preference = crate::config::commands::get_setting_value(app, "interfaceLanguage")
        .ok()
        .flatten()
        .and_then(|value| serde_json::from_str::<String>(&value).ok())
        .unwrap_or_else(|| "system".to_string());

    resolve_locale_preference(&preference, sys_locale::get_locale().as_deref())
}

pub(crate) fn resolve_locale_preference(
    preference: &str,
    system_locale: Option<&str>,
) -> InterfaceLocale {
    match preference {
        "zh-CN" => InterfaceLocale::ZhCn,
        "zh-TW" => InterfaceLocale::ZhTw,
        "en-US" => InterfaceLocale::EnUs,
        "ja-JP" => InterfaceLocale::JaJp,
        "ko-KR" | "fr-FR" | "de-DE" | "es-ES" | "pt-BR" | "ru-RU" | "it-IT" | "tr-TR" | "vi-VN"
        | "th-TH" | "id-ID" => InterfaceLocale::EnUs,
        _ => resolve_system_locale(system_locale),
    }
}

pub(crate) fn resolve_system_locale(system_locale: Option<&str>) -> InterfaceLocale {
    let Some(locale) = system_locale else {
        return InterfaceLocale::EnUs;
    };
    let normalized = locale.trim().to_ascii_lowercase().replace('_', "-");

    if normalized.starts_with("zh-hant")
        || normalized == "zh-tw"
        || normalized.starts_with("zh-tw-")
        || normalized == "zh-hk"
        || normalized.starts_with("zh-hk-")
        || normalized == "zh-mo"
        || normalized.starts_with("zh-mo-")
    {
        return InterfaceLocale::ZhTw;
    }

    if normalized.starts_with("zh-hans")
        || normalized == "zh"
        || normalized == "zh-cn"
        || normalized.starts_with("zh-cn-")
        || normalized == "zh-sg"
        || normalized.starts_with("zh-sg-")
    {
        return InterfaceLocale::ZhCn;
    }

    if normalized == "en" || normalized.starts_with("en-") {
        return InterfaceLocale::EnUs;
    }

    if normalized == "ja" || normalized.starts_with("ja-") {
        return InterfaceLocale::JaJp;
    }

    InterfaceLocale::EnUs
}

pub(crate) fn text(locale: InterfaceLocale, key: &str) -> &'static str {
    match locale {
        InterfaceLocale::ZhCn => zh_cn(key),
        InterfaceLocale::ZhTw => zh_tw(key),
        InterfaceLocale::EnUs => en_us(key),
        InterfaceLocale::JaJp => ja_jp(key),
    }
}

pub(crate) fn app_text<R: Runtime>(app: &AppHandle<R>, key: &str) -> &'static str {
    text(effective_locale(app), key)
}

fn zh_cn(key: &str) -> &'static str {
    match key {
        "settings_window_title" => "偏好设置 - Nomo",
        "tray_open" => "打开 Nomo",
        "tray_exit" => "退出",
        "menu_file" => "文件(&F)",
        "menu_new" => "新建(&N)",
        "menu_new_window" => "新建窗口(&W)",
        "menu_open" => "打开(&O)...",
        "menu_open_folder" => "打开文件夹...",
        "menu_open_recent" => "打开最近",
        "menu_no_recent" => "暂无最近文件",
        "menu_untitled" => "未命名.md",
        "menu_save" => "保存(&S)",
        "menu_save_as" => "另存为(&A)...",
        "menu_export" => "导出",
        "menu_export_html" => "导出 HTML",
        "menu_export_pdf" => "导出 PDF",
        "menu_close_file" => "关闭当前文件",
        "menu_close_window" => "关闭窗口",
        "menu_quit" => "退出(&X)",
        "menu_edit" => "编辑(&E)",
        "menu_undo" => "撤销(&U)",
        "menu_redo" => "重做(&R)",
        "menu_paragraph" => "段落",
        "menu_heading" => "标题",
        "menu_heading_1" => "一级标题",
        "menu_heading_2" => "二级标题",
        "menu_heading_3" => "三级标题",
        "menu_heading_4" => "四级标题",
        "menu_heading_5" => "五级标题",
        "menu_heading_6" => "六级标题",
        "menu_lift_heading" => "提升标题",
        "menu_sink_heading" => "降低标题",
        "menu_table" => "表格",
        "menu_code_block" => "代码块",
        "menu_math_block" => "公式块",
        "menu_blockquote" => "引用",
        "menu_callout" => "提示块",
        "menu_comment_block" => "注释块",
        "menu_ordered_list" => "有序列表",
        "menu_bullet_list" => "无序列表",
        "menu_task_list" => "任务列表",
        "menu_insert_before" => "上插段落",
        "menu_insert_after" => "下插段落",
        "menu_footnote" => "脚注",
        "menu_horizontal_rule" => "水平分割线",
        "menu_toc" => "正文目录",
        "menu_front_matter" => "文档元数据",
        "menu_format" => "格式(&O)",
        "menu_bold" => "加粗",
        "menu_italic" => "斜体",
        "menu_underline" => "下划线",
        "menu_inline_code" => "行代码",
        "menu_inline_math" => "行公式",
        "menu_strike" => "删除线",
        "menu_highlight" => "高亮",
        "menu_comment" => "注释",
        "menu_link" => "超链接",
        "menu_image" => "图像",
        "menu_clear_format" => "清除样式",
        "menu_view" => "查看(&V)",
        "menu_toggle_source" => "切换源码模式",
        "menu_toggle_outline" => "显示/隐藏文档大纲",
        "menu_toggle_theme" => "切换主题",
        "menu_toggle_explorer" => "显示/隐藏资源管理器",
        "menu_settings" => "设置",
        "menu_preferences" => "偏好设置...",
        "menu_chart" => "图表",
        "menu_chart_blank" => "空白图表",
        "menu_chart_flowchart" => "流程图",
        "menu_chart_sequence" => "时序图",
        "menu_chart_class" => "类图",
        "menu_chart_state" => "状态图",
        "menu_chart_pie" => "饼图",
        "menu_chart_gantt" => "甘特图",
        "menu_chart_er" => "ER 图",
        "file_assoc_description" => "轻量 Markdown-first 编辑器",
        "open_with_nomo" => "用 Nomo 打开",
        "open_folder_with_nomo" => "用 Nomo 打开文件夹",
        "md_assoc_registered_default" => ".md 默认打开方式已绑定到 Nomo。",
        "md_assoc_registered_optional" => {
            "Nomo 已注册为可选 Markdown 应用，请在 Windows 默认应用中选择 Nomo。"
        }
        "md_assoc_not_registered" => "尚未注册 Nomo 的 .md 打开方式。",
        "md_assoc_registered_message" => {
            "已注册 Nomo，并打开 Windows 默认应用设置；请选择 Nomo 后这里会显示已绑定。"
        }
        "md_assoc_unregistered_message" => "已取消 Nomo 的 .md 默认打开方式绑定。",
        "context_menu_registered" => "已注册 .md 文件和文件夹右键菜单。",
        "context_menu_not_registered" => "尚未注册 .md 文件和文件夹右键菜单。",
        "context_menu_unregistered_message" => "已取消 .md 文件和文件夹右键菜单注册。",
        "windows_default_only" => "当前默认打开方式绑定仅支持 Windows。",
        "windows_context_only" => "当前右键菜单注册仅支持 Windows。",
        _ => "",
    }
}

fn zh_tw(key: &str) -> &'static str {
    match key {
        "settings_window_title" => "偏好設定 - Nomo",
        "tray_open" => "開啟 Nomo",
        "tray_exit" => "結束",
        "menu_file" => "檔案(&F)",
        "menu_new" => "新增(&N)",
        "menu_new_window" => "新增視窗(&W)",
        "menu_open" => "開啟(&O)...",
        "menu_open_folder" => "開啟資料夾...",
        "menu_open_recent" => "開啟最近項目",
        "menu_no_recent" => "暫無最近檔案",
        "menu_untitled" => "未命名.md",
        "menu_save" => "儲存(&S)",
        "menu_save_as" => "另存新檔(&A)...",
        "menu_export" => "匯出",
        "menu_export_html" => "匯出 HTML",
        "menu_export_pdf" => "匯出 PDF",
        "menu_close_file" => "關閉目前檔案",
        "menu_close_window" => "關閉視窗",
        "menu_quit" => "結束(&X)",
        "menu_edit" => "編輯(&E)",
        "menu_undo" => "復原(&U)",
        "menu_redo" => "重做(&R)",
        "menu_paragraph" => "段落",
        "menu_heading" => "標題",
        "menu_heading_1" => "一級標題",
        "menu_heading_2" => "二級標題",
        "menu_heading_3" => "三級標題",
        "menu_heading_4" => "四級標題",
        "menu_heading_5" => "五級標題",
        "menu_heading_6" => "六級標題",
        "menu_lift_heading" => "提升標題",
        "menu_sink_heading" => "降低標題",
        "menu_table" => "表格",
        "menu_code_block" => "程式碼區塊",
        "menu_math_block" => "公式區塊",
        "menu_blockquote" => "引用",
        "menu_callout" => "提示區塊",
        "menu_comment_block" => "註解區塊",
        "menu_ordered_list" => "有序清單",
        "menu_bullet_list" => "無序清單",
        "menu_task_list" => "任務清單",
        "menu_insert_before" => "上方插入段落",
        "menu_insert_after" => "下方插入段落",
        "menu_footnote" => "註腳",
        "menu_horizontal_rule" => "水平分隔線",
        "menu_toc" => "正文目錄",
        "menu_front_matter" => "文件中繼資料",
        "menu_format" => "格式(&O)",
        "menu_bold" => "粗體",
        "menu_italic" => "斜體",
        "menu_underline" => "底線",
        "menu_inline_code" => "行內程式碼",
        "menu_inline_math" => "行內公式",
        "menu_strike" => "刪除線",
        "menu_highlight" => "醒目提示",
        "menu_comment" => "註解",
        "menu_link" => "超連結",
        "menu_image" => "圖片",
        "menu_clear_format" => "清除樣式",
        "menu_view" => "檢視(&V)",
        "menu_toggle_source" => "切換原始碼模式",
        "menu_toggle_outline" => "顯示/隱藏文件大綱",
        "menu_toggle_theme" => "切換主題",
        "menu_toggle_explorer" => "顯示/隱藏資源管理器",
        "menu_settings" => "設定",
        "menu_preferences" => "偏好設定...",
        "menu_chart" => "圖表",
        "menu_chart_blank" => "空白圖表",
        "menu_chart_flowchart" => "流程圖",
        "menu_chart_sequence" => "時序圖",
        "menu_chart_class" => "類別圖",
        "menu_chart_state" => "狀態圖",
        "menu_chart_pie" => "圓餅圖",
        "menu_chart_gantt" => "甘特圖",
        "menu_chart_er" => "ER 圖",
        "file_assoc_description" => "輕量 Markdown-first 編輯器",
        "open_with_nomo" => "用 Nomo 開啟",
        "open_folder_with_nomo" => "用 Nomo 開啟資料夾",
        "md_assoc_registered_default" => ".md 預設開啟方式已綁定到 Nomo。",
        "md_assoc_registered_optional" => {
            "Nomo 已註冊為可選 Markdown 應用程式，請在 Windows 預設應用程式中選擇 Nomo。"
        }
        "md_assoc_not_registered" => "尚未註冊 Nomo 的 .md 開啟方式。",
        "md_assoc_registered_message" => {
            "已註冊 Nomo，並開啟 Windows 預設應用程式設定；請選擇 Nomo 後這裡會顯示已綁定。"
        }
        "md_assoc_unregistered_message" => "已取消 Nomo 的 .md 預設開啟方式綁定。",
        "context_menu_registered" => "已註冊 .md 檔案和資料夾右鍵選單。",
        "context_menu_not_registered" => "尚未註冊 .md 檔案和資料夾右鍵選單。",
        "context_menu_unregistered_message" => "已取消 .md 檔案和資料夾右鍵選單註冊。",
        "windows_default_only" => "目前預設開啟方式綁定僅支援 Windows。",
        "windows_context_only" => "目前右鍵選單註冊僅支援 Windows。",
        _ => zh_cn(key),
    }
}

fn en_us(key: &str) -> &'static str {
    match key {
        "settings_window_title" => "Preferences - Nomo",
        "tray_open" => "Open Nomo",
        "tray_exit" => "Quit",
        "menu_file" => "File (&F)",
        "menu_new" => "New (&N)",
        "menu_new_window" => "New Window (&W)",
        "menu_open" => "Open (&O)...",
        "menu_open_folder" => "Open Folder...",
        "menu_open_recent" => "Open Recent",
        "menu_no_recent" => "No recent files",
        "menu_untitled" => "Untitled.md",
        "menu_save" => "Save (&S)",
        "menu_save_as" => "Save As (&A)...",
        "menu_export" => "Export",
        "menu_export_html" => "Export HTML",
        "menu_export_pdf" => "Export PDF",
        "menu_close_file" => "Close Current File",
        "menu_close_window" => "Close Window",
        "menu_quit" => "Quit (&X)",
        "menu_edit" => "Edit (&E)",
        "menu_undo" => "Undo (&U)",
        "menu_redo" => "Redo (&R)",
        "menu_paragraph" => "Paragraph",
        "menu_heading" => "Heading",
        "menu_heading_1" => "Heading 1",
        "menu_heading_2" => "Heading 2",
        "menu_heading_3" => "Heading 3",
        "menu_heading_4" => "Heading 4",
        "menu_heading_5" => "Heading 5",
        "menu_heading_6" => "Heading 6",
        "menu_lift_heading" => "Promote Heading",
        "menu_sink_heading" => "Demote Heading",
        "menu_table" => "Table",
        "menu_code_block" => "Code Block",
        "menu_math_block" => "Math Block",
        "menu_blockquote" => "Quote",
        "menu_callout" => "Callout",
        "menu_comment_block" => "Comment Block",
        "menu_ordered_list" => "Ordered List",
        "menu_bullet_list" => "Bulleted List",
        "menu_task_list" => "Task List",
        "menu_insert_before" => "Insert Paragraph Above",
        "menu_insert_after" => "Insert Paragraph Below",
        "menu_footnote" => "Footnote",
        "menu_horizontal_rule" => "Horizontal Rule",
        "menu_toc" => "Table of Contents",
        "menu_front_matter" => "Document Metadata",
        "menu_format" => "Format (&O)",
        "menu_bold" => "Bold",
        "menu_italic" => "Italic",
        "menu_underline" => "Underline",
        "menu_inline_code" => "Inline Code",
        "menu_inline_math" => "Inline Math",
        "menu_strike" => "Strikethrough",
        "menu_highlight" => "Highlight",
        "menu_comment" => "Comment",
        "menu_link" => "Link",
        "menu_image" => "Image",
        "menu_clear_format" => "Clear Formatting",
        "menu_view" => "View (&V)",
        "menu_toggle_source" => "Toggle Source Mode",
        "menu_toggle_outline" => "Show/Hide Document Outline",
        "menu_toggle_theme" => "Toggle Theme",
        "menu_toggle_explorer" => "Show/Hide Explorer",
        "menu_settings" => "Settings",
        "menu_preferences" => "Preferences...",
        "menu_chart" => "Charts",
        "menu_chart_blank" => "Blank Diagram",
        "menu_chart_flowchart" => "Flowchart",
        "menu_chart_sequence" => "Sequence Diagram",
        "menu_chart_class" => "Class Diagram",
        "menu_chart_state" => "State Diagram",
        "menu_chart_pie" => "Pie Chart",
        "menu_chart_gantt" => "Gantt Chart",
        "menu_chart_er" => "ER Diagram",
        "file_assoc_description" => "Lightweight Markdown-first editor",
        "open_with_nomo" => "Open with Nomo",
        "open_folder_with_nomo" => "Open Folder with Nomo",
        "md_assoc_registered_default" => ".md default app is bound to Nomo.",
        "md_assoc_registered_optional" => "Nomo is registered as an optional Markdown app. Choose Nomo in Windows default apps.",
        "md_assoc_not_registered" => "Nomo is not registered as a .md open-with app yet.",
        "md_assoc_registered_message" => "Nomo has been registered and Windows default app settings were opened. Choose Nomo there, then this status will show it is bound.",
        "md_assoc_unregistered_message" => "Nomo .md default app binding has been removed.",
        "context_menu_registered" => "Registered .md file and folder context menus.",
        "context_menu_not_registered" => ".md file and folder context menus are not registered yet.",
        "context_menu_unregistered_message" => ".md file and folder context menu registration has been removed.",
        "windows_default_only" => "Default app binding is currently supported only on Windows.",
        "windows_context_only" => "Context menu registration is currently supported only on Windows.",
        _ => "",
    }
}

fn ja_jp(key: &str) -> &'static str {
    match key {
        "settings_window_title" => "環境設定 - Nomo",
        "tray_open" => "Nomo を開く",
        "tray_exit" => "終了",
        "menu_file" => "ファイル(&F)",
        "menu_new" => "新規(&N)",
        "menu_new_window" => "新規ウィンドウ(&W)",
        "menu_open" => "開く(&O)...",
        "menu_open_folder" => "フォルダーを開く...",
        "menu_open_recent" => "最近使った項目を開く",
        "menu_no_recent" => "最近使ったファイルはありません",
        "menu_untitled" => "無題.md",
        "menu_save" => "保存(&S)",
        "menu_save_as" => "名前を付けて保存(&A)...",
        "menu_export" => "エクスポート",
        "menu_export_html" => "HTML をエクスポート",
        "menu_export_pdf" => "PDF をエクスポート",
        "menu_close_file" => "現在のファイルを閉じる",
        "menu_close_window" => "ウィンドウを閉じる",
        "menu_quit" => "終了(&X)",
        "menu_edit" => "編集(&E)",
        "menu_undo" => "元に戻す(&U)",
        "menu_redo" => "やり直し(&R)",
        "menu_paragraph" => "段落",
        "menu_heading" => "見出し",
        "menu_heading_1" => "見出し 1",
        "menu_heading_2" => "見出し 2",
        "menu_heading_3" => "見出し 3",
        "menu_heading_4" => "見出し 4",
        "menu_heading_5" => "見出し 5",
        "menu_heading_6" => "見出し 6",
        "menu_lift_heading" => "見出しレベルを上げる",
        "menu_sink_heading" => "見出しレベルを下げる",
        "menu_table" => "表",
        "menu_code_block" => "コードブロック",
        "menu_math_block" => "数式ブロック",
        "menu_blockquote" => "引用",
        "menu_callout" => "コールアウト",
        "menu_comment_block" => "コメントブロック",
        "menu_ordered_list" => "番号付きリスト",
        "menu_bullet_list" => "箇条書きリスト",
        "menu_task_list" => "タスクリスト",
        "menu_insert_before" => "上に段落を挿入",
        "menu_insert_after" => "下に段落を挿入",
        "menu_footnote" => "脚注",
        "menu_horizontal_rule" => "水平線",
        "menu_toc" => "目次",
        "menu_front_matter" => "文書メタデータ",
        "menu_format" => "書式(&O)",
        "menu_bold" => "太字",
        "menu_italic" => "斜体",
        "menu_underline" => "下線",
        "menu_inline_code" => "インラインコード",
        "menu_inline_math" => "インライン数式",
        "menu_strike" => "取り消し線",
        "menu_highlight" => "ハイライト",
        "menu_comment" => "コメント",
        "menu_link" => "リンク",
        "menu_image" => "画像",
        "menu_clear_format" => "書式をクリア",
        "menu_view" => "表示(&V)",
        "menu_toggle_source" => "ソースモードを切り替え",
        "menu_toggle_outline" => "文書アウトラインを表示/非表示",
        "menu_toggle_theme" => "テーマを切り替え",
        "menu_toggle_explorer" => "エクスプローラーを表示/非表示",
        "menu_settings" => "設定",
        "menu_preferences" => "環境設定...",
        "menu_chart" => "図表",
        "menu_chart_blank" => "空白の図表",
        "menu_chart_flowchart" => "フローチャート",
        "menu_chart_sequence" => "シーケンス図",
        "menu_chart_class" => "クラス図",
        "menu_chart_state" => "状態図",
        "menu_chart_pie" => "円グラフ",
        "menu_chart_gantt" => "ガントチャート",
        "menu_chart_er" => "ER 図",
        "file_assoc_description" => "軽量 Markdown-first エディター",
        "open_with_nomo" => "Nomo で開く",
        "open_folder_with_nomo" => "Nomo でフォルダーを開く",
        "md_assoc_registered_default" => ".md の既定アプリは Nomo に関連付けられています。",
        "md_assoc_registered_optional" => "Nomo は任意の Markdown アプリとして登録されています。Windows の既定のアプリで Nomo を選択してください。",
        "md_assoc_not_registered" => "Nomo の .md 開くアプリはまだ登録されていません。",
        "md_assoc_registered_message" => "Nomo を登録し、Windows の既定のアプリ設定を開きました。そこで Nomo を選択すると、ここに関連付け済みと表示されます。",
        "md_assoc_unregistered_message" => "Nomo の .md 既定アプリの関連付けを解除しました。",
        "context_menu_registered" => ".md ファイルとフォルダーのコンテキストメニューを登録しました。",
        "context_menu_not_registered" => ".md ファイルとフォルダーのコンテキストメニューはまだ登録されていません。",
        "context_menu_unregistered_message" => ".md ファイルとフォルダーのコンテキストメニュー登録を解除しました。",
        "windows_default_only" => "既定アプリの関連付けは現在 Windows のみ対応しています。",
        "windows_context_only" => "コンテキストメニュー登録は現在 Windows のみ対応しています。",
        _ => "",
    }
}

#[cfg(test)]
mod tests {
    use super::{resolve_locale_preference, resolve_system_locale, text, InterfaceLocale};

    #[test]
    fn resolves_explicit_preferences() {
        assert_eq!(
            resolve_locale_preference("zh-CN", Some("en-US")),
            InterfaceLocale::ZhCn
        );
        assert_eq!(
            resolve_locale_preference("zh-TW", Some("zh-CN")),
            InterfaceLocale::ZhTw
        );
        assert_eq!(
            resolve_locale_preference("en-US", Some("zh-CN")),
            InterfaceLocale::EnUs
        );
        assert_eq!(
            resolve_locale_preference("ja-JP", Some("zh-CN")),
            InterfaceLocale::JaJp
        );
        assert_eq!(
            resolve_locale_preference("fr-FR", Some("zh-CN")),
            InterfaceLocale::EnUs
        );
    }

    #[test]
    fn resolves_system_locale_families() {
        assert_eq!(resolve_system_locale(Some("zh-CN")), InterfaceLocale::ZhCn);
        assert_eq!(
            resolve_system_locale(Some("zh-Hans-CN")),
            InterfaceLocale::ZhCn
        );
        assert_eq!(resolve_system_locale(Some("zh_TW")), InterfaceLocale::ZhTw);
        assert_eq!(
            resolve_system_locale(Some("zh-Hant-HK")),
            InterfaceLocale::ZhTw
        );
        assert_eq!(resolve_system_locale(Some("en-US")), InterfaceLocale::EnUs);
        assert_eq!(resolve_system_locale(Some("ja")), InterfaceLocale::JaJp);
        assert_eq!(resolve_system_locale(Some("ja-JP")), InterfaceLocale::JaJp);
        assert_eq!(resolve_system_locale(Some("ja_JP")), InterfaceLocale::JaJp);
        assert_eq!(resolve_system_locale(Some("fr-FR")), InterfaceLocale::EnUs);
        assert_eq!(resolve_system_locale(None), InterfaceLocale::EnUs);
    }

    #[test]
    fn returns_localized_native_chrome_text() {
        assert_eq!(text(InterfaceLocale::ZhCn, "tray_open"), "打开 Nomo");
        assert_eq!(text(InterfaceLocale::ZhTw, "tray_open"), "開啟 Nomo");
        assert_eq!(text(InterfaceLocale::EnUs, "tray_open"), "Open Nomo");
        assert_eq!(text(InterfaceLocale::JaJp, "tray_open"), "Nomo を開く");

        assert_eq!(text(InterfaceLocale::ZhCn, "menu_chart_blank"), "空白图表");
        assert_eq!(text(InterfaceLocale::ZhTw, "menu_chart_blank"), "空白圖表");
        assert_eq!(
            text(InterfaceLocale::EnUs, "menu_chart_blank"),
            "Blank Diagram"
        );
        assert_eq!(
            text(InterfaceLocale::JaJp, "menu_chart_blank"),
            "空白の図表"
        );
        assert_eq!(text(InterfaceLocale::JaJp, "menu_file"), "ファイル(&F)");
        assert_eq!(
            text(InterfaceLocale::JaJp, "settings_window_title"),
            "環境設定 - Nomo"
        );
    }
}
