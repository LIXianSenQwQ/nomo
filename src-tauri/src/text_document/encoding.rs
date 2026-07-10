use super::{LineEnding, TextEncoding};

pub(super) const UTF8_BOM: &[u8; 3] = b"\xEF\xBB\xBF";

#[derive(Debug, Clone, Copy)]
pub(super) struct EncodingProbe {
    pub(super) encoding: TextEncoding,
    pub(super) bom_len: u64,
    pub(super) line_ending: LineEnding,
}

pub(super) fn probe(bytes: &[u8], complete_file: bool) -> EncodingProbe {
    let (body, bom_len, utf8_encoding) = if bytes.starts_with(UTF8_BOM) {
        (&bytes[UTF8_BOM.len()..], 3, TextEncoding::Utf8Bom)
    } else {
        (bytes, 0, TextEncoding::Utf8)
    };
    // 随机探测块尾可能落在多字节字符内部；只有确定的非法序列才能判为 unsupported。
    let encoding = match std::str::from_utf8(body) {
        Ok(_) => utf8_encoding,
        Err(error) if !complete_file && error.error_len().is_none() => utf8_encoding,
        Err(_) => TextEncoding::Unsupported,
    };
    EncodingProbe {
        encoding,
        bom_len,
        line_ending: detect_line_ending(body),
    }
}

pub(super) fn detect_line_ending(bytes: &[u8]) -> LineEnding {
    let mut lf = 0_u64;
    let mut crlf = 0_u64;
    let mut lone_cr = 0_u64;
    let mut index = 0_usize;
    while index < bytes.len() {
        if bytes[index] == b'\r' && bytes.get(index + 1) == Some(&b'\n') {
            crlf += 1;
            index += 2;
        } else {
            if bytes[index] == b'\n' {
                lf += 1;
            } else if bytes[index] == b'\r' {
                lone_cr += 1;
            }
            index += 1;
        }
    }
    if crlf > 0 && lf == 0 && lone_cr == 0 {
        LineEnding::Crlf
    } else if crlf == 0 && lone_cr == 0 {
        LineEnding::Lf
    } else {
        // 协议没有单独的 CR 枚举；CR-only 与混合换行都必须显式归入 Mixed。
        LineEnding::Mixed
    }
}

pub(super) fn normalize_inserted_text(text: &str, line_ending: LineEnding) -> Vec<u8> {
    if line_ending != LineEnding::Crlf {
        return text.as_bytes().to_vec();
    }
    let mut output = Vec::with_capacity(text.len());
    let bytes = text.as_bytes();
    let mut index = 0_usize;
    while index < bytes.len() {
        if bytes[index] == b'\r' && bytes.get(index + 1) == Some(&b'\n') {
            output.extend_from_slice(b"\r\n");
            index += 2;
        } else if bytes[index] == b'\n' {
            output.extend_from_slice(b"\r\n");
            index += 1;
        } else {
            output.push(bytes[index]);
            index += 1;
        }
    }
    output
}

pub(super) fn count_line_breaks(bytes: &[u8]) -> u64 {
    let mut previous_cr = false;
    let mut breaks = advance_line_breaks(bytes, &mut previous_cr);
    if previous_cr {
        breaks += 1;
    }
    breaks
}

/// 流式统计逻辑换行；尾部 CR 延迟到下一块，保证跨块 CRLF 只计一次。
pub(super) fn advance_line_breaks(bytes: &[u8], previous_cr: &mut bool) -> u64 {
    let mut breaks = 0_u64;
    for byte in bytes {
        if *previous_cr {
            breaks += 1;
            *previous_cr = false;
            if *byte == b'\n' {
                continue;
            }
        }
        match *byte {
            b'\r' => *previous_cr = true,
            b'\n' => breaks += 1,
            _ => {}
        }
    }
    breaks
}

/// 非 UTF-8 文档只读显示时，同时生成 UTF-16 边界到原始窗口字节的映射。
/// 映射长度恒为 `text.encode_utf16().count() + 1`，避免 replacement char 改写全局偏移。
pub(super) fn decode_lossy_with_utf16_offsets(bytes: &[u8]) -> (String, Vec<u32>) {
    let mut text = String::new();
    let mut offsets = vec![0_u32];
    let mut cursor = 0_usize;
    while cursor < bytes.len() {
        match std::str::from_utf8(&bytes[cursor..]) {
            Ok(valid) => {
                append_valid_with_offsets(&mut text, &mut offsets, valid, cursor);
                break;
            }
            Err(error) => {
                let valid_end = cursor + error.valid_up_to();
                let valid = unsafe {
                    // SAFETY: Utf8Error::valid_up_to 保证此前缀是有效 UTF-8。
                    std::str::from_utf8_unchecked(&bytes[cursor..valid_end])
                };
                append_valid_with_offsets(&mut text, &mut offsets, valid, cursor);
                cursor = valid_end;
                let invalid_len = error
                    .error_len()
                    .unwrap_or_else(|| bytes.len().saturating_sub(cursor));
                text.push('\u{fffd}');
                cursor += invalid_len;
                offsets.push(cursor as u32);
            }
        }
    }
    (text, offsets)
}

fn append_valid_with_offsets(
    output: &mut String,
    offsets: &mut Vec<u32>,
    valid: &str,
    base: usize,
) {
    for (relative, character) in valid.char_indices() {
        let start = base + relative;
        let end = start + character.len_utf8();
        output.push(character);
        if character.len_utf16() == 2 {
            // 代理项中间不是合法编辑边界，映射到字符起点供前端拒绝拆分。
            offsets.push(start as u32);
        }
        offsets.push(end as u32);
    }
}

#[cfg(test)]
mod tests {
    use super::{count_line_breaks, decode_lossy_with_utf16_offsets, detect_line_ending};
    use crate::text_document::LineEnding;

    #[test]
    fn lossy_decode_keeps_original_offsets_for_invalid_bytes_and_surrogates() {
        let (text, offsets) = decode_lossy_with_utf16_offsets(b"a\xff\xf0\x9f\x98\x80b");
        assert_eq!(text, "a\u{fffd}\u{1f600}b");
        assert_eq!(offsets, vec![0, 1, 2, 2, 6, 7]);
        assert_eq!(offsets.len(), text.encode_utf16().count() + 1);
    }

    #[test]
    fn cr_only_and_lone_cr_are_counted_consistently_with_probe() {
        assert_eq!(count_line_breaks(b"a\rb\rc"), 2);
        assert_eq!(count_line_breaks(b"a\r\nb\rc\n"), 3);
        assert_eq!(detect_line_ending(b"a\rb\r"), LineEnding::Mixed);
        assert_eq!(detect_line_ending(b"a\r\nb\r\n"), LineEnding::Crlf);
        assert_eq!(detect_line_ending(b"a\r\nb\r"), LineEnding::Mixed);
    }
}
