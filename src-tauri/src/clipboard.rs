//! Leitura e escrita do clipboard em vários formatos: texto (com a formatação HTML/RTF que
//! vier junto) e imagens. No Windows usa a API Win32 diretamente; fora dele, só texto, pelo
//! `tauri-plugin-clipboard-manager`.

use std::io::Cursor;

use image::{DynamicImage, ImageFormat, RgbaImage};
use tauri::AppHandle;

/// Itens maiores que isso (somando os formatos) não entram no histórico.
pub const MAX_ITEM_BYTES: usize = 10 * 1024 * 1024;

/// Lado máximo da miniatura de uma imagem, em pixels.
pub const THUMBNAIL_SIZE: u32 = 64;

#[derive(Debug, Clone, PartialEq)]
pub enum Content {
    Text(TextContent),
    Image(ImageContent),
}

/// Texto simples, com os blocos de formatação como vieram do programa de origem.
#[derive(Debug, Clone, PartialEq)]
pub struct TextContent {
    pub text: String,
    /// Formato "HTML Format" do Windows (UTF-8 com cabeçalho de posições).
    pub html: Option<Vec<u8>>,
    /// Formato "Rich Text Format".
    pub rtf: Option<Vec<u8>>,
}

impl TextContent {
    #[cfg(test)]
    pub fn plain(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            html: None,
            rtf: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ImageContent {
    pub png: Vec<u8>,
    /// PNG de até `THUMBNAIL_SIZE` px de lado, para o menu de colagem.
    pub thumbnail: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

/// Conteúdo lido do clipboard, antes da conversão das imagens (feita fora da thread que
/// lê o clipboard, para não segurá-la).
#[derive(Debug)]
pub enum Captured {
    Text(TextContent),
    /// Formato "PNG" registrado por alguns programas (navegadores, Office).
    Png(Vec<u8>),
    /// `CF_DIBV5` ou `CF_DIB`: o bitmap sem o cabeçalho de arquivo.
    Dib(Vec<u8>),
}

impl Captured {
    /// Converte para o formato guardado; `None` se a imagem não puder ser decodificada.
    pub fn into_content(self) -> Option<Content> {
        match self {
            Self::Text(text) => Some(Content::Text(text)),
            Self::Png(png) => {
                let image = image::load_from_memory_with_format(&png, ImageFormat::Png).ok()?;
                image_content(image).map(Content::Image)
            }
            Self::Dib(dib) => decode_dib(&dib).and_then(image_content).map(Content::Image),
        }
    }
}

fn encode_png(image: &DynamicImage) -> Option<Vec<u8>> {
    let mut png = Vec::new();
    image
        .write_to(&mut Cursor::new(&mut png), ImageFormat::Png)
        .ok()?;
    Some(png)
}

fn image_content(image: DynamicImage) -> Option<ImageContent> {
    let (width, height) = (image.width(), image.height());
    if width == 0 || height == 0 {
        return None;
    }
    let thumbnail = if width <= THUMBNAIL_SIZE && height <= THUMBNAIL_SIZE {
        image.clone()
    } else {
        image.thumbnail(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
    };
    Some(ImageContent {
        png: encode_png(&image)?,
        thumbnail: encode_png(&thumbnail)?,
        width,
        height,
    })
}

/// Monta um arquivo BMP a partir de um DIB, acrescentando o cabeçalho de arquivo, que
/// diz onde começam os pixels (depois do cabeçalho, das máscaras e da paleta).
fn bmp_file(dib: &[u8]) -> Option<Vec<u8>> {
    const FILE_HEADER: u32 = 14;
    const BI_BITFIELDS: u32 = 3;
    const BI_ALPHABITFIELDS: u32 = 6;
    let u16_at = |at: usize| Some(u16::from_le_bytes(dib.get(at..at + 2)?.try_into().ok()?));
    let u32_at = |at: usize| Some(u32::from_le_bytes(dib.get(at..at + 4)?.try_into().ok()?));

    let header = u32_at(0)?;
    if header < 40 || header as usize > dib.len() {
        return None;
    }
    let bit_count = u32::from(u16_at(14)?);
    let compression = u32_at(16)?;
    let colors_used = u32_at(32)?;
    // No cabeçalho simples (40 bytes), as máscaras de cor vêm logo depois dele.
    let masks = match (header, compression) {
        (40, BI_BITFIELDS) => 12,
        (40, BI_ALPHABITFIELDS) => 16,
        _ => 0,
    };
    let palette = if colors_used > 0 {
        colors_used
    } else if bit_count <= 8 {
        1 << bit_count
    } else {
        0
    };
    let offset = FILE_HEADER + header + masks + palette * 4;
    let size = FILE_HEADER + u32::try_from(dib.len()).ok()?;

    let mut file = Vec::with_capacity(size as usize);
    file.extend_from_slice(b"BM");
    file.extend_from_slice(&size.to_le_bytes());
    file.extend_from_slice(&[0; 4]);
    file.extend_from_slice(&offset.to_le_bytes());
    file.extend_from_slice(dib);
    Some(file)
}

fn decode_dib(dib: &[u8]) -> Option<DynamicImage> {
    let image = image::load_from_memory_with_format(&bmp_file(dib)?, ImageFormat::Bmp).ok()?;
    Some(opaque_if_invisible(image))
}

/// Vários programas gravam bitmaps de 32 bits com o canal alfa todo zerado, sem
/// pretender transparência; nesse caso a imagem é tratada como opaca.
fn opaque_if_invisible(image: DynamicImage) -> DynamicImage {
    if !image.color().has_alpha() {
        return image;
    }
    let mut rgba = image.to_rgba8();
    if rgba.pixels().any(|pixel| pixel[3] != 0) {
        return image;
    }
    rgba.pixels_mut().for_each(|pixel| pixel[3] = u8::MAX);
    DynamicImage::ImageRgba8(rgba)
}

/// DIB de 32 bits (`BITMAPINFOHEADER` com `BI_RGB`, linhas de baixo para cima), o
/// formato de imagem que todo programa do Windows aceita colar.
fn dib_from_rgba(image: &RgbaImage) -> Vec<u8> {
    let (width, height) = image.dimensions();
    let pixels = width as usize * height as usize * 4;
    let mut dib = Vec::with_capacity(40 + pixels);
    dib.extend_from_slice(&40u32.to_le_bytes());
    dib.extend_from_slice(&(width as i32).to_le_bytes());
    dib.extend_from_slice(&(height as i32).to_le_bytes());
    dib.extend_from_slice(&1u16.to_le_bytes()); // planos
    dib.extend_from_slice(&32u16.to_le_bytes()); // bits por pixel
    dib.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
    dib.extend_from_slice(&(pixels as u32).to_le_bytes());
    dib.extend_from_slice(&[0; 16]); // resolução e paleta
    for row in image.rows().rev() {
        for pixel in row {
            let [r, g, b, a] = pixel.0;
            dib.extend_from_slice(&[b, g, r, a]);
        }
    }
    dib
}

/// Documento no formato "HTML Format" do Windows para um fragmento HTML: cabeçalho com
/// as posições em bytes (10 dígitos) e o fragmento entre os marcadores. Sem o NUL final,
/// que a escrita no clipboard acrescenta.
pub fn html_format(fragment: &str) -> Vec<u8> {
    // Os números têm sempre 10 dígitos, então o cabeçalho tem tamanho fixo.
    const HEADER_LEN: usize = "Version:0.9\r\nStartHTML:0000000000\r\nEndHTML:0000000000\r\nStartFragment:0000000000\r\nEndFragment:0000000000\r\n".len();
    const PREFIX: &str = "<html><body><!--StartFragment-->";
    const SUFFIX: &str = "<!--EndFragment--></body></html>";
    let start_html = HEADER_LEN;
    let start_fragment = start_html + PREFIX.len();
    let end_fragment = start_fragment + fragment.len();
    let end_html = end_fragment + SUFFIX.len();
    format!(
        "Version:0.9\r\nStartHTML:{start_html:010}\r\nEndHTML:{end_html:010}\r\nStartFragment:{start_fragment:010}\r\nEndFragment:{end_fragment:010}\r\n{PREFIX}{fragment}{SUFFIX}"
    )
    .into_bytes()
}

/// Texto UTF-16 até o primeiro caractere nulo.
fn text_from_utf16(bytes: &[u8]) -> String {
    let units: Vec<u16> = bytes
        .as_chunks::<2>()
        .0
        .iter()
        .map(|&pair| u16::from_le_bytes(pair))
        .take_while(|&unit| unit != 0)
        .collect();
    String::from_utf16_lossy(&units)
}

fn utf16_with_nul(text: &str) -> Vec<u8> {
    text.encode_utf16()
        .chain([0])
        .flat_map(u16::to_le_bytes)
        .collect()
}

/// Bytes sem os nulos finais que os formatos de texto trazem.
fn trim_nul(mut bytes: Vec<u8>) -> Vec<u8> {
    while bytes.last() == Some(&0) {
        bytes.pop();
    }
    bytes
}

fn with_nul(bytes: &[u8]) -> Vec<u8> {
    let mut data = bytes.to_vec();
    data.push(0);
    data
}

/// O programa de origem pediu que o conteúdo não fosse guardado: gerenciadores de senha
/// marcam o que é sensível com formatos próprios ou com `CanIncludeInClipboardHistory`
/// valendo zero.
fn excluded(marked: bool, can_include: Option<&[u8]>) -> bool {
    marked
        || can_include
            .and_then(|data| data.get(..4))
            .is_some_and(|value| value == [0, 0, 0, 0])
}

/// PNG como `data:` URL, para a interface mostrar sem outro pedido ao backend.
pub fn png_data_url(png: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut url = String::with_capacity(22 + png.len().div_ceil(3) * 4);
    url.push_str("data:image/png;base64,");
    for chunk in png.chunks(3) {
        let bytes = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let group = u32::from_be_bytes([0, bytes[0], bytes[1], bytes[2]]);
        for index in 0..4 {
            if index <= chunk.len() {
                url.push(char::from(
                    ALPHABET[(group >> (18 - 6 * index)) as usize & 63],
                ));
            } else {
                url.push('=');
            }
        }
    }
    url
}

/// Lê o conteúdo atual para o histórico. `None` quando não há o que guardar: conteúdo
/// vazio, marcado como sensível, arquivos do Explorer, formatos não suportados, item
/// acima de `MAX_ITEM_BYTES` ou clipboard ocupado por outro programa.
#[cfg(windows)]
pub fn read() -> Option<Captured> {
    platform::read()
}

/// O conteúdo atual foi escrito pelo próprio CSTM (colagem, cópia ou restauração).
#[cfg(windows)]
pub fn written_by_cstm() -> bool {
    platform::written_by_cstm()
}

/// Janela que o CSTM usa como dona do clipboard ao escrever: a do monitor do histórico,
/// que assim reconhece e ignora as escritas do próprio CSTM.
#[cfg(windows)]
pub fn set_owner(window: isize) {
    platform::OWNER.store(window, std::sync::atomic::Ordering::Relaxed);
}

/// Cópia bruta dos formatos do clipboard, para devolvê-los depois com `restore`.
pub use platform::Snapshot;

/// Copia os bytes do texto (com HTML/RTF), da imagem (PNG ou DIB) que estiverem no
/// clipboard, sem decodificar nada nem aplicar os filtros do histórico (tamanho,
/// conteúdo sensível). `None` se o clipboard não abriu ou não há nenhum desses formatos.
pub fn snapshot() -> Option<Snapshot> {
    platform::snapshot()
}

/// Devolve ao clipboard uma cópia feita por `snapshot`; o CSTM é o dono, então o
/// histórico ignora a escrita.
pub fn restore(app: &AppHandle, snapshot: &Snapshot) -> Result<(), String> {
    platform::restore(app, snapshot).map_err(|error| format!("não foi possível restaurar: {error}"))
}

/// Substitui o conteúdo do clipboard por todos os formatos do item.
pub fn write(app: &AppHandle, content: &Content) -> Result<(), String> {
    platform::write(app, content).map_err(|error| format!("não foi possível copiar: {error}"))
}

#[cfg(windows)]
mod platform {
    use std::sync::atomic::{AtomicIsize, Ordering};
    use std::thread;
    use std::time::Duration;

    use image::ImageFormat;
    use tauri::AppHandle;
    use windows::Win32::Foundation::{GlobalFree, HANDLE, HGLOBAL, HWND};
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, GetClipboardData, GetClipboardOwner,
        IsClipboardFormatAvailable, OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows::Win32::System::Memory::{
        GMEM_MOVEABLE, GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock,
    };
    use windows::core::{PCWSTR, w};

    use super::{
        Captured, Content, MAX_ITEM_BYTES, TextContent, dib_from_rgba, excluded, text_from_utf16,
        trim_nul, utf16_with_nul, with_nul,
    };

    // Formatos predefinidos do Windows (`CF_*`).
    const CF_DIB: u32 = 8;
    const CF_UNICODETEXT: u32 = 13;
    const CF_HDROP: u32 = 15;
    const CF_DIBV5: u32 = 17;

    const OPEN_ATTEMPTS: u32 = 10;
    const OPEN_RETRY: Duration = Duration::from_millis(20);

    /// Janela do monitor (`HWND` como inteiro); zero enquanto ele não existe.
    pub static OWNER: AtomicIsize = AtomicIsize::new(0);

    fn owner() -> Option<HWND> {
        match OWNER.load(Ordering::Relaxed) {
            0 => None,
            window => Some(HWND(window as *mut _)),
        }
    }

    fn registered(name: PCWSTR) -> u32 {
        unsafe { RegisterClipboardFormatW(name) }
    }

    fn available(format: u32) -> bool {
        format != 0 && unsafe { IsClipboardFormatAvailable(format) }.is_ok()
    }

    /// Clipboard aberto; fecha ao sair do escopo.
    struct Open;

    impl Drop for Open {
        fn drop(&mut self) {
            let _ = unsafe { CloseClipboard() };
        }
    }

    /// Abre o clipboard, tentando de novo enquanto outro programa o mantém aberto.
    fn open(owner: Option<HWND>) -> Option<Open> {
        for attempt in 0..OPEN_ATTEMPTS {
            if unsafe { OpenClipboard(owner) }.is_ok() {
                return Some(Open);
            }
            if attempt + 1 < OPEN_ATTEMPTS {
                thread::sleep(OPEN_RETRY);
            }
        }
        None
    }

    /// O item passou do tamanho máximo.
    struct TooLarge;

    /// Bytes de um formato, descontados de `budget`. Precisa do clipboard aberto.
    fn data(format: u32, budget: &mut usize) -> Result<Option<Vec<u8>>, TooLarge> {
        if !available(format) {
            return Ok(None);
        }
        let Ok(handle) = (unsafe { GetClipboardData(format) }) else {
            return Ok(None);
        };
        let memory = HGLOBAL(handle.0);
        let size = unsafe { GlobalSize(memory) };
        if size > *budget {
            return Err(TooLarge);
        }
        *budget -= size;
        let pointer = unsafe { GlobalLock(memory) };
        if pointer.is_null() {
            return Ok(None);
        }
        let bytes = unsafe { std::slice::from_raw_parts(pointer.cast::<u8>(), size) }.to_vec();
        let _ = unsafe { GlobalUnlock(memory) };
        Ok(Some(bytes))
    }

    pub fn written_by_cstm() -> bool {
        let current = unsafe { GetClipboardOwner() }.ok();
        current.is_some_and(|window| Some(window) == owner())
    }

    pub fn read() -> Option<Captured> {
        let _open = open(None)?;
        let marked = available(registered(w!(
            "ExcludeClipboardContentFromMonitorProcessing"
        ))) || available(registered(w!("Clipboard Viewer Ignore")));
        let mut flag_budget = MAX_ITEM_BYTES;
        let can_include = data(
            registered(w!("CanIncludeInClipboardHistory")),
            &mut flag_budget,
        )
        .ok()
        .flatten();
        // Arquivos copiados no Explorer ficam fora do histórico.
        if excluded(marked, can_include.as_deref()) || available(CF_HDROP) {
            return None;
        }

        let mut budget = MAX_ITEM_BYTES;
        if let Some(raw) = data(CF_UNICODETEXT, &mut budget).ok()? {
            let text = text_from_utf16(&raw);
            if text.trim().is_empty() {
                return None;
            }
            let html = data(registered(w!("HTML Format")), &mut budget).ok()?;
            let rtf = data(registered(w!("Rich Text Format")), &mut budget).ok()?;
            return Some(Captured::Text(TextContent {
                text,
                html: html.map(trim_nul).filter(|html| !html.is_empty()),
                rtf: rtf.map(trim_nul).filter(|rtf| !rtf.is_empty()),
            }));
        }
        if let Some(png) = data(registered(w!("PNG")), &mut budget).ok()? {
            return Some(Captured::Png(png));
        }
        // O Windows converte entre os dois; o V5 preserva a transparência.
        for format in [CF_DIBV5, CF_DIB] {
            if let Some(dib) = data(format, &mut budget).ok()? {
                return Some(Captured::Dib(dib));
            }
        }
        None
    }

    fn set(format: u32, bytes: &[u8]) -> windows::core::Result<()> {
        unsafe {
            let memory = GlobalAlloc(GMEM_MOVEABLE, bytes.len().max(1))?;
            let pointer = GlobalLock(memory);
            if pointer.is_null() {
                let _ = GlobalFree(Some(memory));
                return Err(windows::core::Error::from_thread());
            }
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), pointer.cast::<u8>(), bytes.len());
            let _ = GlobalUnlock(memory);
            // Depois de entregue ao clipboard, a memória pertence ao Windows.
            if let Err(error) = SetClipboardData(format, Some(HANDLE(memory.0))) {
                let _ = GlobalFree(Some(memory));
                return Err(error);
            }
        }
        Ok(())
    }

    /// Formatos a gravar para o item, preparados antes de abrir o clipboard.
    fn formats(content: &Content) -> Result<Vec<(u32, Vec<u8>)>, String> {
        Ok(match content {
            Content::Text(text) => {
                let mut formats = vec![(CF_UNICODETEXT, utf16_with_nul(&text.text))];
                if let Some(html) = &text.html {
                    formats.push((registered(w!("HTML Format")), with_nul(html)));
                }
                if let Some(rtf) = &text.rtf {
                    formats.push((registered(w!("Rich Text Format")), with_nul(rtf)));
                }
                formats
            }
            Content::Image(image) => {
                let decoded = image::load_from_memory_with_format(&image.png, ImageFormat::Png)
                    .map_err(|error| error.to_string())?;
                vec![
                    (CF_DIB, dib_from_rgba(&decoded.to_rgba8())),
                    // Quem aceita PNG (Office, navegadores) recebe a transparência.
                    (registered(w!("PNG")), image.png.clone()),
                ]
            }
        })
    }

    /// Substitui o conteúdo do clipboard pelos formatos dados.
    fn replace(formats: &[(u32, Vec<u8>)]) -> Result<(), String> {
        let _open = open(owner()).ok_or("o clipboard está em uso por outro programa")?;
        unsafe { EmptyClipboard() }.map_err(|error| error.message())?;
        for (format, bytes) in formats {
            set(*format, bytes).map_err(|error| error.message())?;
        }
        Ok(())
    }

    pub fn write(_app: &AppHandle, content: &Content) -> Result<(), String> {
        replace(&formats(content)?)
    }

    /// Bytes brutos dos formatos que o CSTM sabe escrever de volta.
    pub struct Snapshot(Vec<(u32, Vec<u8>)>);

    pub fn snapshot() -> Option<Snapshot> {
        let _open = open(None)?;
        let mut budget = usize::MAX;
        let mut formats = Vec::new();
        let mut take = |format: u32| {
            if let Ok(Some(bytes)) = data(format, &mut budget) {
                formats.push((format, bytes));
                true
            } else {
                false
            }
        };
        take(CF_UNICODETEXT);
        take(registered(w!("HTML Format")));
        take(registered(w!("Rich Text Format")));
        take(registered(w!("PNG")));
        // O Windows sintetiza um a partir do outro: basta o primeiro disponível.
        let _ = take(CF_DIBV5) || take(CF_DIB);
        (!formats.is_empty()).then_some(Snapshot(formats))
    }

    pub fn restore(_app: &AppHandle, snapshot: &Snapshot) -> Result<(), String> {
        replace(&snapshot.0)
    }
}

/// Fora do Windows, só texto, pelo plugin de clipboard.
#[cfg(not(windows))]
mod platform {
    use tauri::AppHandle;
    use tauri_plugin_clipboard_manager::ClipboardExt;

    use super::Content;

    /// Sem cópia bruta fora do Windows.
    pub struct Snapshot;

    pub fn snapshot() -> Option<Snapshot> {
        None
    }

    pub fn restore(_app: &AppHandle, _snapshot: &Snapshot) -> Result<(), String> {
        Ok(())
    }

    pub fn write(app: &AppHandle, content: &Content) -> Result<(), String> {
        match content {
            Content::Text(text) => app
                .clipboard()
                .write_text(text.text.clone())
                .map_err(|error| error.to_string()),
            Content::Image(_) => Err("imagens só no Windows".to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    fn sample(width: u32, height: u32, alpha: u8) -> RgbaImage {
        RgbaImage::from_fn(width, height, |x, y| {
            Rgba([(x * 40) as u8, (y * 60) as u8, 200, alpha])
        })
    }

    #[test]
    fn dib_round_trips_through_png() {
        let original = sample(5, 3, 255);
        let Some(Content::Image(image)) = Captured::Dib(dib_from_rgba(&original)).into_content()
        else {
            panic!("a imagem deveria ser decodificada");
        };
        assert_eq!((image.width, image.height), (5, 3));
        let decoded = image::load_from_memory(&image.png).unwrap().to_rgba8();
        assert_eq!(decoded, original);
    }

    #[test]
    fn keeps_transparency_but_fixes_an_all_zero_alpha() {
        let mut translucent = sample(2, 2, 255);
        translucent.put_pixel(0, 0, Rgba([1, 2, 3, 0]));
        let kept = opaque_if_invisible(DynamicImage::ImageRgba8(translucent.clone()));
        assert_eq!(kept.to_rgba8(), translucent);

        let invisible = opaque_if_invisible(DynamicImage::ImageRgba8(sample(2, 2, 0))).to_rgba8();
        assert!(invisible.pixels().all(|pixel| pixel[3] == 255));
    }

    #[test]
    fn decodes_a_24_bit_dib_with_padded_rows() {
        // 3 × 2 px, 24 bits: cada linha tem 9 bytes de pixels e 3 de preenchimento.
        let mut dib = Vec::new();
        dib.extend_from_slice(&40u32.to_le_bytes());
        dib.extend_from_slice(&3i32.to_le_bytes());
        dib.extend_from_slice(&2i32.to_le_bytes());
        dib.extend_from_slice(&1u16.to_le_bytes());
        dib.extend_from_slice(&24u16.to_le_bytes());
        dib.extend_from_slice(&[0; 24]);
        for _ in 0..2 {
            dib.extend_from_slice(&[255, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0, 0]);
        }
        let image = decode_dib(&dib).unwrap().to_rgba8();
        assert_eq!(image.dimensions(), (3, 2));
        assert_eq!(image.get_pixel(1, 1).0, [0, 0, 255, 255]);
    }

    #[test]
    fn invalid_images_are_not_kept() {
        assert_eq!(Captured::Dib(vec![1, 2, 3]).into_content(), None);
        assert_eq!(Captured::Png(b"nao e png".to_vec()).into_content(), None);
    }

    #[test]
    fn thumbnail_fits_the_menu_size_and_keeps_the_proportion() {
        let Some(Content::Image(image)) =
            Captured::Dib(dib_from_rgba(&sample(256, 128, 255))).into_content()
        else {
            panic!("a imagem deveria ser decodificada");
        };
        let thumbnail = image::load_from_memory(&image.thumbnail).unwrap();
        assert_eq!((thumbnail.width(), thumbnail.height()), (64, 32));
        assert_eq!((image.width, image.height), (256, 128));
    }

    #[test]
    fn reads_utf16_up_to_the_terminator() {
        let mut bytes = utf16_with_nul("Olá, ação");
        bytes.extend_from_slice(&[0x41, 0, 0, 0]);
        assert_eq!(text_from_utf16(&bytes), "Olá, ação");
    }

    #[test]
    fn formatting_blocks_lose_and_regain_the_terminator() {
        assert_eq!(trim_nul(b"<b>x</b>\0\0".to_vec()), b"<b>x</b>");
        assert_eq!(with_nul(b"{\\rtf1}"), b"{\\rtf1}\0");
    }

    #[test]
    fn html_format_offsets_point_at_the_document_and_the_fragment() {
        let fragment = "<p><strong>Olá</strong>, ação</p>";
        let bytes = html_format(fragment);
        let text = String::from_utf8(bytes.clone()).unwrap();
        let offset = |name: &str| -> usize {
            let line = text.lines().find(|l| l.starts_with(name)).unwrap();
            line[name.len()..].parse().unwrap()
        };
        let (start_html, end_html) = (offset("StartHTML:"), offset("EndHTML:"));
        let (start_fragment, end_fragment) = (offset("StartFragment:"), offset("EndFragment:"));

        assert_eq!(end_html, bytes.len());
        assert!(bytes[start_html..].starts_with(b"<html>"));
        assert!(bytes[..end_html].ends_with(b"</html>"));
        assert_eq!(&bytes[start_fragment..end_fragment], fragment.as_bytes());
        assert!(bytes[..start_fragment].ends_with(b"<!--StartFragment-->"));
        assert!(bytes[end_fragment..].starts_with(b"<!--EndFragment-->"));
    }

    #[test]
    fn honours_the_exclusion_markers() {
        assert!(!excluded(false, None));
        assert!(excluded(true, None));
        assert!(excluded(false, Some(&[0, 0, 0, 0])));
        assert!(!excluded(false, Some(&[1, 0, 0, 0])));
    }

    #[test]
    fn encodes_png_as_a_data_url() {
        assert_eq!(png_data_url(b""), "data:image/png;base64,");
        assert_eq!(png_data_url(b"f"), "data:image/png;base64,Zg==");
        assert_eq!(png_data_url(b"fo"), "data:image/png;base64,Zm8=");
        assert_eq!(png_data_url(b"foobar"), "data:image/png;base64,Zm9vYmFy");
    }
}
