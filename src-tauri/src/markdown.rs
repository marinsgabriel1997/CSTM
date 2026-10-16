//! Conversão do markdown dos textos cadastrados para os modos de colagem (plano 082).
//!
//! Funções puras, sem Tauri nem clipboard: o conteúdo é sempre guardado como markdown e
//! a conversão acontece só na colagem.

use std::str::FromStr;

use htmd::element_handler::{HandlerResult, Handlers};
use htmd::options::{BulletListMarker, Options as HtmdOptions};
use htmd::{Element, HtmlToMarkdown};
use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd, html};
use serde::{Deserialize, Serialize};

/// Modo de colagem de um texto cadastrado.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PasteFormat {
    /// Sem formatação: remove a marcação.
    Plain,
    /// Markdown (fonte): o conteúdo como está.
    #[default]
    Markdown,
    /// Formatado: HTML com o texto sem formatação de reserva.
    Rich,
    /// Sintaxe do Google Chat.
    Chat,
}

impl PasteFormat {
    /// Valor guardado em `settings`.
    pub fn as_str(self) -> &'static str {
        match self {
            PasteFormat::Plain => "plain",
            PasteFormat::Markdown => "markdown",
            PasteFormat::Rich => "rich",
            PasteFormat::Chat => "chat",
        }
    }
}

impl FromStr for PasteFormat {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "plain" => Ok(PasteFormat::Plain),
            "markdown" => Ok(PasteFormat::Markdown),
            "rich" => Ok(PasteFormat::Rich),
            "chat" => Ok(PasteFormat::Chat),
            other => Err(format!("Modo de colagem inválido: {other}")),
        }
    }
}

/// Conteúdo a escrever no clipboard: sempre o texto; no modo Formatado, também o HTML.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Converted {
    pub text: String,
    pub html: Option<String>,
}

/// Converte o markdown para o modo pedido. No modo Markdown devolve o conteúdo intacto.
pub fn convert(md: &str, format: PasteFormat) -> Converted {
    match format {
        PasteFormat::Markdown => Converted {
            text: md.to_string(),
            html: None,
        },
        PasteFormat::Plain => Converted {
            text: to_plain(md),
            html: None,
        },
        PasteFormat::Rich => Converted {
            text: to_plain(md),
            html: Some(to_html(md)),
        },
        PasteFormat::Chat => Converted {
            text: to_google_chat(md),
            html: None,
        },
    }
}

fn options() -> Options {
    Options::ENABLE_STRIKETHROUGH | Options::ENABLE_TABLES
}

/// Texto sem marcação. Sem quebra de linha no fim.
pub fn to_plain(md: &str) -> String {
    walk(md, Style::Plain)
}

/// Fragmento HTML. As quebras de linha simples viram `<br>`, pois o usuário escreve
/// linhas de propósito.
pub fn to_html(md: &str) -> String {
    let events = Parser::new_ext(md, options()).map(|event| match event {
        Event::SoftBreak => Event::HardBreak,
        other => other,
    });
    let mut out = String::new();
    html::push_html(&mut out, events);
    out
}

/// Texto na sintaxe do Google Chat. Sem quebra de linha no fim.
pub fn to_google_chat(md: &str) -> String {
    walk(md, Style::Chat)
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Style {
    Plain,
    Chat,
}

enum Ctx {
    Quote,
    /// Próximo número se a lista for ordenada.
    List(Option<u64>),
    Item,
}

/// Percorre os eventos do parser e monta o texto; plain e chat diferem só nos marcadores.
struct Walker {
    style: Style,
    out: String,
    stack: Vec<Ctx>,
    /// Separação pendente antes do próximo bloco: 0 nenhuma, 1 quebra de linha, 2 linha em branco.
    sep: u8,
    at_line_start: bool,
    /// O marcador de um item acabou de ser escrito e ainda não há conteúdo.
    just_marker: bool,
    /// A linha em branco da separação já foi escrita (evita duplicá-la).
    blank_done: bool,
    in_code: bool,
    in_heading: bool,
    /// Tamanho de `out` logo após cada marcador de ênfase aberto (chat).
    marks: Vec<usize>,
    /// Destino e posição inicial do texto de cada link ou imagem aberto.
    links: Vec<(String, usize)>,
    cells: Vec<String>,
    cell_start: usize,
}

fn walk(md: &str, style: Style) -> String {
    let mut events: Vec<Event> = Parser::new_ext(md, options()).collect();
    if style == Style::Chat {
        swap_emphasis_nesting(&mut events);
    }
    let mut walker = Walker {
        style,
        out: String::new(),
        stack: Vec::new(),
        sep: 0,
        at_line_start: true,
        just_marker: false,
        blank_done: false,
        in_code: false,
        in_heading: false,
        marks: Vec::new(),
        links: Vec::new(),
        cells: Vec::new(),
        cell_start: 0,
    };
    for event in events {
        walker.event(event);
    }
    walker.out.trim_end().to_string()
}

/// Índice do evento que fecha o `Start` em `i`.
fn matching_end(events: &[Event], i: usize) -> Option<usize> {
    let mut depth = 0usize;
    for (k, event) in events.iter().enumerate().skip(i) {
        match event {
            Event::Start(_) => depth += 1,
            Event::End(_) => {
                depth -= 1;
                if depth == 0 {
                    return Some(k);
                }
            }
            _ => {}
        }
    }
    None
}

/// Negrito dentro de itálico (`_*x*_`) vira itálico dentro de negrito (`*_x_*`), a forma
/// que o Google Chat interpreta de modo mais previsível.
fn swap_emphasis_nesting(events: &mut [Event]) {
    for i in 0..events.len().saturating_sub(1) {
        if matches!(events[i], Event::Start(Tag::Emphasis))
            && matches!(events[i + 1], Event::Start(Tag::Strong))
            && let (Some(j), Some(k)) = (matching_end(events, i), matching_end(events, i + 1))
            && k + 1 == j
        {
            events.swap(i, i + 1);
            events.swap(k, j);
        }
    }
}

impl Walker {
    fn chat(&self) -> bool {
        self.style == Style::Chat
    }

    /// Prefixo de linha dos `upto` primeiros contextos: citação (só no chat) e recuo de
    /// 2 espaços por lista.
    fn prefix(&self, upto: usize) -> String {
        let mut p = String::new();
        for ctx in &self.stack[..upto] {
            match ctx {
                Ctx::Quote if self.chat() => p.push_str("> "),
                Ctx::List(_) => p.push_str("  "),
                _ => {}
            }
        }
        p
    }

    /// Escreve a separação pendente. Linhas em branco levam o prefixo sem espaços finais.
    fn flush_sep(&mut self) {
        if self.sep > 0 && !self.out.is_empty() {
            if !self.at_line_start {
                self.out.push('\n');
                self.at_line_start = true;
            }
            if self.sep >= 2 && !self.blank_done {
                let p = self.prefix(self.stack.len());
                self.out.push_str(p.trim_end());
                self.out.push('\n');
                self.blank_done = true;
            }
        }
        self.sep = 0;
    }

    /// Pede separação antes de um bloco; logo após o marcador de um item não separa.
    fn sep_at(&mut self, level: u8) {
        if self.just_marker {
            return;
        }
        self.sep = self.sep.max(level);
        self.flush_sep();
    }

    /// Prepara a escrita de conteúdo na linha atual.
    fn begin(&mut self) {
        if self.at_line_start {
            let p = self.prefix(self.stack.len());
            self.out.push_str(&p);
            self.at_line_start = false;
        }
        self.just_marker = false;
        self.blank_done = false;
    }

    fn write(&mut self, s: &str) {
        self.begin();
        self.out.push_str(s);
    }

    /// Escreve texto de várias linhas (código e HTML), preservando cada linha.
    fn write_lines(&mut self, s: &str) {
        for seg in s.split_inclusive('\n') {
            let line = seg.strip_suffix('\n');
            let content = line.unwrap_or(seg);
            if self.at_line_start && content.is_empty() {
                let p = self.prefix(self.stack.len());
                self.out.push_str(p.trim_end());
                self.just_marker = false;
                self.blank_done = false;
            } else {
                self.write(content);
            }
            if line.is_some() {
                self.out.push('\n');
                self.at_line_start = true;
            }
        }
    }

    /// Abre um marcador de ênfase do chat.
    fn open(&mut self, marker: &str) {
        if self.chat() {
            self.write(marker);
            self.marks.push(self.out.len());
        }
    }

    /// Fecha o marcador; se não houve conteúdo, remove o marcador de abertura.
    fn close(&mut self, marker: &str) {
        if self.chat()
            && let Some(pos) = self.marks.pop()
        {
            if self.out.len() == pos {
                self.out.truncate(pos - marker.len());
            } else {
                self.out.push_str(marker);
            }
        }
    }

    fn event(&mut self, event: Event) {
        match event {
            Event::Start(tag) => self.start(tag),
            Event::End(tag) => self.end(tag),
            Event::Text(text) if self.in_code => self.write_lines(&text),
            Event::Text(text) => self.write(&text),
            Event::Code(code) if self.chat() => self.write(&format!("`{code}`")),
            Event::Code(code) => self.write(&code),
            Event::Html(html) => self.write_lines(&html),
            Event::InlineHtml(html) => self.write(&html),
            Event::SoftBreak | Event::HardBreak => {
                self.sep = self.sep.max(1);
                self.flush_sep();
            }
            Event::Rule => {
                self.sep_at(2);
                self.write("---");
            }
            _ => {}
        }
    }

    fn start(&mut self, tag: Tag) {
        match tag {
            Tag::Paragraph | Tag::HtmlBlock | Tag::Table(_) => self.sep_at(2),
            Tag::Heading { .. } => {
                self.sep_at(2);
                self.in_heading = true;
                self.open("*");
            }
            Tag::BlockQuote(_) => {
                self.sep_at(2);
                self.stack.push(Ctx::Quote);
            }
            Tag::CodeBlock(_) => {
                self.sep_at(2);
                self.in_code = true;
                if self.chat() {
                    self.write("```");
                    self.sep_at(1);
                }
            }
            Tag::List(start) => {
                let level = if matches!(self.stack.last(), Some(Ctx::Item)) {
                    1
                } else {
                    2
                };
                self.sep_at(level);
                self.stack.push(Ctx::List(start));
            }
            Tag::Item => {
                let bullet = if self.chat() { "- " } else { "• " };
                let marker = match self.stack.last_mut() {
                    Some(Ctx::List(Some(n))) => {
                        let m = format!("{n}. ");
                        *n += 1;
                        m
                    }
                    _ => bullet.to_string(),
                };
                self.just_marker = false;
                self.sep_at(1);
                let p = self.prefix(self.stack.len().saturating_sub(1));
                self.out.push_str(&p);
                self.out.push_str(&marker);
                self.at_line_start = false;
                self.just_marker = true;
                self.blank_done = false;
                self.stack.push(Ctx::Item);
            }
            Tag::Strikethrough => self.open("~"),
            Tag::Emphasis => self.open("_"),
            Tag::Strong if !self.in_heading => self.open("*"),
            Tag::Link { dest_url, .. } | Tag::Image { dest_url, .. } => {
                self.begin();
                self.links.push((dest_url.to_string(), self.out.len()));
            }
            Tag::TableHead | Tag::TableRow => {
                self.sep_at(1);
                self.begin();
            }
            Tag::TableCell => self.cell_start = self.out.len(),
            _ => {}
        }
    }

    fn end(&mut self, tag: TagEnd) {
        match tag {
            TagEnd::Heading(_) => {
                self.close("*");
                self.in_heading = false;
            }
            TagEnd::BlockQuote(_) | TagEnd::List(_) | TagEnd::Item => {
                self.stack.pop();
            }
            TagEnd::CodeBlock => {
                self.in_code = false;
                if self.chat() {
                    self.sep_at(1);
                    self.write("```");
                }
            }
            TagEnd::Strikethrough => self.close("~"),
            TagEnd::Emphasis => self.close("_"),
            TagEnd::Strong if !self.in_heading => self.close("*"),
            TagEnd::Link | TagEnd::Image => {
                if let Some((url, pos)) = self.links.pop() {
                    let text = &self.out[pos..];
                    if text.is_empty() {
                        self.out.push_str(&url);
                    } else if !url.is_empty() && text != url && format!("mailto:{text}") != url {
                        self.out.push_str(&format!(" ({url})"));
                    }
                }
            }
            TagEnd::TableCell => {
                let cell = self.out.split_off(self.cell_start);
                self.cells.push(cell);
            }
            TagEnd::TableHead | TagEnd::TableRow => {
                let row = self.cells.join(" | ");
                self.out.push_str(&row);
                self.cells.clear();
            }
            _ => {}
        }
    }
}

// --- Normalização do Histórico para markdown (plano 083) ---

/// Markdown de um item de texto do Histórico: o HTML formatado que veio junto, a sintaxe do
/// Google Chat ou, nos demais casos, o próprio texto. `html` é o "HTML Format" do Windows.
pub fn history_markdown(text: &str, html: Option<&[u8]>) -> String {
    if let Some(md) = html.and_then(html_to_markdown) {
        return md;
    }
    chat_to_markdown(text).unwrap_or_else(|| text.to_string())
}

/// Fragmento HTML do "HTML Format": o trecho entre `StartFragment` e `EndFragment` do
/// cabeçalho; sem offsets válidos, o que vem depois do cabeçalho.
fn html_fragment(bytes: &[u8]) -> String {
    let len = bytes.iter().rposition(|&b| b != 0).map_or(0, |i| i + 1);
    let bytes = &bytes[..len];
    let offset = |key: &str| -> Option<usize> {
        let head = &bytes[..bytes.len().min(512)];
        let key = key.as_bytes();
        let at = head.windows(key.len()).position(|w| w == key)? + key.len();
        let digits: Vec<u8> = head[at..]
            .iter()
            .copied()
            .take_while(u8::is_ascii_digit)
            .collect();
        std::str::from_utf8(&digits).ok()?.parse().ok()
    };
    let fragment = match (offset("StartFragment:"), offset("EndFragment:")) {
        (Some(start), Some(end)) if start <= end && end <= bytes.len() => &bytes[start..end],
        _ if bytes.starts_with(b"Version:") => {
            let start = bytes.iter().position(|&b| b == b'<').unwrap_or(bytes.len());
            &bytes[start..]
        }
        _ => bytes,
    };
    String::from_utf8_lossy(fragment).into_owned()
}

/// Tags cuja presença indica formatação de verdade (e não só estrutura ou estilo).
const FORMATTING_TAGS: [&str; 20] = [
    "b",
    "strong",
    "i",
    "em",
    "s",
    "strike",
    "del",
    "code",
    "pre",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "a",
];

/// O estilo marca o "negrito" do Google Docs, que envolve tudo em
/// `<b style="font-weight:normal">`: não é negrito.
fn is_normal_weight(style: &str) -> bool {
    style
        .replace(' ', "")
        .to_ascii_lowercase()
        .contains("font-weight:normal")
}

/// O HTML tem alguma tag de formatação?
fn has_formatting(html: &str) -> bool {
    let lower = html.to_ascii_lowercase();
    FORMATTING_TAGS.iter().any(|tag| {
        let open = format!("<{tag}");
        lower.match_indices(&open).any(|(at, _)| {
            let rest = &lower[at + open.len()..];
            let Some(next) = rest.chars().next() else {
                return false;
            };
            if !(next == '>' || next == '/' || next.is_whitespace()) {
                return false;
            }
            let attrs = &rest[..rest.find('>').unwrap_or(rest.len())];
            match *tag {
                "a" => attrs.contains("href"),
                "b" | "strong" => !is_normal_weight(attrs),
                _ => true,
            }
        })
    })
}

/// Conteúdo do elemento com o marcador nas pontas; os espaços de borda ficam de fora dele.
fn wrap_inline(handlers: &dyn Handlers, element: &Element, marker: &str) -> Option<HandlerResult> {
    let content = handlers.walk_children(element.node).content;
    let inner = content.trim();
    if inner.is_empty() {
        return None;
    }
    let start = content.len() - content.trim_start().len();
    let end = start + inner.len();
    Some(
        format!(
            "{}{marker}{inner}{marker}{}",
            &content[..start],
            &content[end..]
        )
        .into(),
    )
}

/// Converte o HTML formatado em markdown; `None` se não houver formatação ou o resultado
/// sair vazio (vale então o texto).
fn html_to_markdown(bytes: &[u8]) -> Option<String> {
    let fragment = html_fragment(bytes);
    if !has_formatting(&fragment) {
        return None;
    }
    let converter = HtmlToMarkdown::builder()
        .options(HtmdOptions {
            bullet_list_marker: BulletListMarker::Dash,
            ul_bullet_spacing: 1,
            ol_number_spacing: 1,
            ..HtmdOptions::default()
        })
        .skip_tags(vec!["style", "script", "head", "title"])
        .add_handler(vec!["b", "strong"], |h: &dyn Handlers, e: Element| {
            let normal = e
                .attrs
                .iter()
                .any(|a| &*a.name.local == "style" && is_normal_weight(&a.value));
            if normal {
                Some(h.walk_children(e.node))
            } else {
                wrap_inline(h, &e, "**")
            }
        })
        // O htmd usa `*` no itálico; o projeto usa `_`.
        .add_handler(vec!["i", "em"], |h: &dyn Handlers, e: Element| {
            wrap_inline(h, &e, "_")
        })
        // O htmd não trata tachado.
        .add_handler(
            vec!["s", "strike", "del"],
            |h: &dyn Handlers, e: Element| wrap_inline(h, &e, "~~"),
        )
        .build();
    let md = converter.convert(&fragment).ok()?;
    let md = md.trim();
    (!md.is_empty()).then(|| md.to_string())
}

/// Texto na sintaxe do Google Chat (`*negrito*`, `~tachado~`) em markdown; `None` se não
/// parecer dela: sem esses marcadores ou já com `**`/`~~`.
fn chat_to_markdown(text: &str) -> Option<String> {
    if text.contains("**") || text.contains("~~") {
        return None;
    }
    let mut changed = false;
    let mut in_fence = false;
    let lines: Vec<String> = text
        .split('\n')
        .map(|line| {
            if line.trim_start().starts_with("```") {
                in_fence = !in_fence;
                return line.to_string();
            }
            if in_fence {
                return line.to_string();
            }
            // Os trechos entre crases (código inline) ficam como estão.
            line.split('`')
                .enumerate()
                .map(|(i, part)| {
                    if i % 2 == 1 {
                        part.to_string()
                    } else {
                        let bold = double_delimiters(part, '*', &mut changed);
                        double_delimiters(&bold, '~', &mut changed)
                    }
                })
                .collect::<Vec<_>>()
                .join("`")
        })
        .collect();
    changed.then(|| lines.join("\n"))
}

/// Dobra o delimitador de `*x*` (ou `~x~`): a abertura não vem depois de letra, número ou
/// do próprio delimitador nem antes de espaço; o fechamento não vem depois de espaço nem
/// antes de letra, número ou do delimitador. Assim `* item` e `5 * 3` ficam como estão.
fn double_delimiters(part: &str, mark: char, changed: &mut bool) -> String {
    let chars: Vec<char> = part.chars().collect();
    let word = |c: char| c.is_alphanumeric() || c == '_' || c == mark;
    let mut out = String::new();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == mark
            && (i == 0 || !word(chars[i - 1]))
            && chars
                .get(i + 1)
                .is_some_and(|&c| !c.is_whitespace() && c != mark)
            && let Some(close) = chars[i + 1..]
                .iter()
                .position(|&c| c == mark)
                .map(|p| p + i + 1)
            && !chars[close - 1].is_whitespace()
            && chars.get(close + 1).is_none_or(|&c| !word(c))
        {
            out.push(mark);
            out.push(mark);
            out.extend(&chars[i + 1..close]);
            out.push(mark);
            out.push(mark);
            *changed = true;
            i = close + 1;
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }
    out
}

#[cfg(test)]
mod history_tests {
    use super::*;
    use crate::clipboard::html_format;

    fn from_html(fragment: &str) -> String {
        history_markdown("texto", Some(&html_format(fragment)))
    }

    #[test]
    fn html_com_formatacao_vira_markdown() {
        assert_eq!(from_html("<b>a</b> e <strong>b</strong>"), "**a** e **b**");
        assert_eq!(from_html("<i>a</i> e <em>b</em>"), "_a_ e _b_");
        assert_eq!(
            from_html("<s>a</s> <del>b</del> <strike>c</strike>"),
            "~~a~~ ~~b~~ ~~c~~"
        );
        assert_eq!(from_html("x <code>y</code>"), "x `y`");
        assert_eq!(
            from_html("<a href=\"https://a.com\">site</a>"),
            "[site](https://a.com)"
        );
        assert_eq!(
            from_html("<h1>Título</h1><p>corpo</p>"),
            "# Título\n\ncorpo"
        );
        assert_eq!(
            from_html("<ul><li>um</li><li>dois</li></ul>"),
            "- um\n- dois"
        );
        assert_eq!(
            from_html("<ol><li>um</li><li>dois</li></ol>"),
            "1. um\n2. dois"
        );
        assert_eq!(from_html("<blockquote>q</blockquote>"), "> q");
        assert_eq!(
            from_html("<pre><code>fn a() {}</code></pre>"),
            "```\nfn a() {}\n```"
        );
    }

    #[test]
    fn html_ignora_estilo_script_e_comentario() {
        assert_eq!(
            from_html("<style>b{color:red}</style><script>x()</script><!-- c --><b>a</b>"),
            "**a**"
        );
    }

    #[test]
    fn html_sem_formatacao_usa_o_texto() {
        let html = html_format("<div><span style=\"color:red\">**a**</span></div>");
        assert_eq!(history_markdown("**a**", Some(&html)), "**a**");
        let docs = html_format("<b style=\"font-weight:normal\">sem negrito</b>");
        assert_eq!(history_markdown("sem negrito", Some(&docs)), "sem negrito");
        // Link sem href não é formatação.
        assert_eq!(from_html("<a name=\"x\">t</a>"), "texto");
    }

    #[test]
    fn cf_html_com_offsets_e_sem_eles() {
        let completo = html_format("<b>dentro</b>");
        assert_eq!(history_markdown("t", Some(&completo)), "**dentro**");
        // Sem cabeçalho: o HTML inteiro, com NUL final.
        let mut cru = b"<p><b>cru</b></p>".to_vec();
        cru.push(0);
        assert_eq!(history_markdown("t", Some(&cru)), "**cru**");
        // Offsets inválidos: vale o que vem depois do cabeçalho.
        let ruim = b"Version:0.9\r\nStartFragment:9999999999\r\nEndFragment:0000000001\r\n<b>x</b>";
        assert_eq!(history_markdown("t", Some(ruim)), "**x**");
        // UTF-8 inválido não derruba.
        let mut sujo = html_format("<b>a</b>");
        sujo.extend([0xff, 0xfe]);
        assert_eq!(history_markdown("t", Some(&sujo)), "**a**");
    }

    #[test]
    fn texto_do_chat_vira_markdown() {
        assert_eq!(
            history_markdown("*negrito* e ~tachado~ e _itálico_", None),
            "**negrito** e ~~tachado~~ e _itálico_"
        );
        assert_eq!(history_markdown("oi *ação*!", None), "oi **ação**!");
    }

    #[test]
    fn textos_que_ficam_intactos() {
        for s in [
            "**a** e *b*",
            "~~a~~ e ~b~",
            "- item\n* item\n* outro",
            "5 * 3 = 15",
            "2*3*4",
            "use `*x*` aqui",
            "```\n*x*\n```",
            "texto puro",
            "",
        ] {
            assert_eq!(history_markdown(s, None), s);
        }
    }

    #[test]
    fn chat_ignora_codigo_mas_converte_o_resto() {
        assert_eq!(
            history_markdown("*a* `*b*`\n```\n*c*\n```\n* item", None),
            "**a** `*b*`\n```\n*c*\n```\n* item"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Regra horizontal: `---` nos dois modos de texto.
    const SAMPLE: &str = "# Título\n\nTexto com **negrito**, *itálico*, ***ambos*** e ~~tachado~~ e `código`.\nSegunda linha.\n\n> citação\n> em duas linhas\n\n- um\n- dois\n  - filho\n\n3. três\n4. quatro\n\n[site](https://a.com) e <https://b.com>\n\n![logo](https://a.com/l.png)\n\n```rust\nfn main() {}\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n---\n\nfim";

    #[test]
    fn paste_format_serde_e_string() {
        assert_eq!(PasteFormat::default(), PasteFormat::Markdown);
        for f in [
            PasteFormat::Plain,
            PasteFormat::Markdown,
            PasteFormat::Rich,
            PasteFormat::Chat,
        ] {
            assert_eq!(f.as_str().parse::<PasteFormat>().unwrap(), f);
            assert_eq!(
                serde_json::to_string(&f).unwrap(),
                format!("\"{}\"", f.as_str())
            );
            assert_eq!(
                serde_json::from_str::<PasteFormat>(&format!("\"{}\"", f.as_str())).unwrap(),
                f
            );
        }
        assert!("outro".parse::<PasteFormat>().is_err());
    }

    #[test]
    fn markdown_fica_intacto() {
        let md = "# T\r\n\r\n**a**  \n\n";
        let c = convert(md, PasteFormat::Markdown);
        assert_eq!(c.text, md);
        assert_eq!(c.html, None);
    }

    #[test]
    fn rich_devolve_html_e_texto_de_reserva() {
        let c = convert("**a**\nb", PasteFormat::Rich);
        assert_eq!(c.text, "a\nb");
        assert_eq!(
            c.html.as_deref(),
            Some("<p><strong>a</strong><br />\nb</p>\n")
        );
        assert_eq!(convert("x", PasteFormat::Plain).html, None);
        assert_eq!(convert("x", PasteFormat::Chat).html, None);
    }

    #[test]
    fn html_elementos() {
        assert_eq!(to_html("~~a~~"), "<p><del>a</del></p>\n");
        assert!(to_html("| A |\n|---|\n| 1 |").contains("<table>"));
        assert_eq!(
            to_html("[x](https://a.com)"),
            "<p><a href=\"https://a.com\">x</a></p>\n"
        );
        assert_eq!(to_html("Ação é *útil*"), "<p>Ação é <em>útil</em></p>\n");
    }

    #[test]
    fn texto_sem_marcacao_igual_nos_dois_modos() {
        for s in ["Olá, ação não é fácil", "linha 1\nlinha 2", "a\n\nb"] {
            assert_eq!(to_plain(s), s);
            assert_eq!(to_google_chat(s), s);
        }
        // Sem quebra final sobrando.
        assert_eq!(to_plain("abc\n\n"), "abc");
        assert_eq!(to_google_chat("abc\n\n"), "abc");
        assert_eq!(to_plain(""), "");
    }

    #[test]
    fn paragrafos_e_quebras() {
        assert_eq!(to_plain("a\nb\n\nc"), "a\nb\n\nc");
        assert_eq!(to_plain("a  \nb"), "a\nb");
        assert_eq!(to_google_chat("a\nb\n\nc"), "a\nb\n\nc");
    }

    #[test]
    fn enfases() {
        assert_eq!(to_plain("**a** *b* ***c*** ~~d~~"), "a b c d");
        assert_eq!(to_google_chat("**a** *b* ~~d~~"), "*a* _b_ ~d~");
        assert_eq!(to_google_chat("***c***"), "*_c_*");
        assert_eq!(to_google_chat("*__c__*"), "*_c_*");
        assert_eq!(to_google_chat("_a **b** c_"), "_a *b* c_");
        assert_eq!(to_google_chat("**ação**"), "*ação*");
    }

    #[test]
    fn enfase_vazia_nao_emite_marcadores() {
        assert_eq!(to_google_chat("a **** b"), "a **** b");
        assert_eq!(to_google_chat("a [**](u) b"), "a ** (u) b");
    }

    #[test]
    fn codigo_inline() {
        assert_eq!(to_plain("use `x` aqui"), "use x aqui");
        assert_eq!(to_google_chat("use `x` aqui"), "use `x` aqui");
    }

    #[test]
    fn bloco_de_codigo() {
        let md = "antes\n\n```rust\nfn a() {}\n\n  b\n```\n\ndepois";
        assert_eq!(to_plain(md), "antes\n\nfn a() {}\n\n  b\n\ndepois");
        assert_eq!(
            to_google_chat(md),
            "antes\n\n```\nfn a() {}\n\n  b\n```\n\ndepois"
        );
        assert_eq!(to_google_chat("    indentado"), "```\nindentado\n```");
    }

    #[test]
    fn citacao() {
        assert_eq!(to_plain("> a\n> b\n\nc"), "a\nb\n\nc");
        assert_eq!(to_google_chat("> a\n> b\n\nc"), "> a\n> b\n\nc");
        assert_eq!(to_google_chat("> a\n>\n> b"), "> a\n>\n> b");
        assert_eq!(to_google_chat("x\n\n> a"), "x\n\n> a");
        // Citação aninhada: o parser fecha o parágrafo e a linha em branco leva só o `>` externo.
        assert_eq!(to_google_chat("> a\n> > b"), "> a\n>\n> > b");
    }

    #[test]
    fn listas() {
        assert_eq!(to_plain("- a\n- b"), "• a\n• b");
        assert_eq!(to_google_chat("- a\n- b"), "- a\n- b");
        assert_eq!(to_plain("1. a\n2. b"), "1. a\n2. b");
        assert_eq!(to_plain("3. a\n4. b"), "3. a\n4. b");
        assert_eq!(to_google_chat("3. a\n4. b"), "3. a\n4. b");
        assert_eq!(
            to_plain("- a\n  - b\n    - c\n- d"),
            "• a\n  • b\n    • c\n• d"
        );
        assert_eq!(to_google_chat("- a\n  1. b\n  2. c"), "- a\n  1. b\n  2. c");
        assert_eq!(
            to_plain("texto\n\n- a\n- b\n\nfim"),
            "texto\n\n• a\n• b\n\nfim"
        );
        assert_eq!(to_plain("- a\n\n  b\n- c"), "• a\n\n  b\n• c");
        assert_eq!(to_plain("- **a** [l](u)"), "• a l (u)");
    }

    #[test]
    fn titulos() {
        assert_eq!(to_plain("# A\n\ntexto\n\n## B"), "A\n\ntexto\n\nB");
        assert_eq!(
            to_google_chat("# A\n\ntexto\n\n## B *i*"),
            "*A*\n\ntexto\n\n*B _i_*"
        );
        assert_eq!(to_google_chat("# **A**"), "*A*");
    }

    #[test]
    fn links_e_imagens() {
        assert_eq!(to_plain("[texto](https://a.com)"), "texto (https://a.com)");
        assert_eq!(
            to_google_chat("[texto](https://a.com)"),
            "texto (https://a.com)"
        );
        assert_eq!(to_plain("<https://a.com>"), "https://a.com");
        assert_eq!(to_google_chat("<https://a.com>"), "https://a.com");
        assert_eq!(to_plain("<a@b.com>"), "a@b.com");
        assert_eq!(to_plain("[https://a.com](https://a.com)"), "https://a.com");
        assert_eq!(
            to_plain("![logo](https://a.com/l.png)"),
            "logo (https://a.com/l.png)"
        );
        assert_eq!(
            to_google_chat("![logo](https://a.com/l.png)"),
            "logo (https://a.com/l.png)"
        );
        assert_eq!(to_plain("![](https://a.com/l.png)"), "https://a.com/l.png");
        assert_eq!(to_google_chat("veja [**ação**](u)"), "veja *ação* (u)");
    }

    #[test]
    fn tabelas() {
        let md = "antes\n\n| A | B |\n|---|:-:|\n| 1 | **2** |\n| ç | |\n\ndepois";
        let esperado = "antes\n\nA | B\n1 | 2\nç | \n\ndepois";
        assert_eq!(to_plain(md), esperado);
        assert_eq!(
            to_google_chat(md),
            "antes\n\nA | B\n1 | *2*\nç | \n\ndepois"
        );
    }

    #[test]
    fn regra_horizontal_e_html() {
        assert_eq!(to_plain("a\n\n---\n\nb"), "a\n\n---\n\nb");
        assert_eq!(to_google_chat("a\n\n---\n\nb"), "a\n\n---\n\nb");
        assert_eq!(to_plain("a <b>x</b>"), "a <b>x</b>");
        assert_eq!(
            to_plain("<div>\nx\n</div>\n\nfim"),
            "<div>\nx\n</div>\n\nfim"
        );
    }

    #[test]
    fn amostra_completa() {
        let plain = to_plain(SAMPLE);
        let chat = to_google_chat(SAMPLE);
        println!("--- plain ---\n{plain}\n--- chat ---\n{chat}");
        assert!(!plain.contains('*') && !plain.contains('#') && !plain.contains("```"));
        assert!(chat.starts_with("*Título*\n\n"));
        assert!(!plain.ends_with('\n') && !chat.ends_with('\n'));
    }
}
