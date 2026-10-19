//! Verificação de atualização: consulta a última release publicada no GitHub, guarda o
//! resultado e avisa o usuário (evento para a janela principal e notificação do Windows).
//! O CSTM nunca baixa nem instala nada: o aviso só leva à página da release.

use std::sync::{Mutex, PoisonError};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::db::settings;

const LATEST_URL: &str = "https://api.github.com/repos/marinsgabriel1997/CSTM/releases/latest";
const RELEASES_PREFIX: &str = "https://github.com/marinsgabriel1997/CSTM/releases/";

/// Evento enviado à janela principal quando há uma versão nova ainda não dispensada.
pub const AVAILABLE_EVENT: &str = "update-available";

const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
const STARTUP_DELAY: Duration = Duration::from_secs(10);
const LOOP_INTERVAL: Duration = Duration::from_secs(3600);
const SECONDS_PER_DAY: i64 = 86_400;
/// Folga somada ao horário em que o limite volta: o relógio do PC e o do GitHub podem divergir.
const RATE_LIMIT_MARGIN_SECS: i64 = 30;
/// Menor espera antes de reconsultar depois de um limite, para não insistir em sequência.
const MIN_RETRY_WAIT_SECS: i64 = 60;

/// Falha de uma verificação; o limite de consultas carrega o horário de nova tentativa.
#[derive(Debug, PartialEq)]
enum CheckError {
    Failed(String),
    /// `retry_at` em segundos Unix, quando o GitHub informou.
    RateLimited {
        retry_at: Option<i64>,
    },
}

impl CheckError {
    fn message(&self, now: i64) -> String {
        match self {
            Self::Failed(message) => message.clone(),
            Self::RateLimited { retry_at } => rate_limit_message(now, *retry_at),
        }
    }
}

impl From<String> for CheckError {
    fn from(message: String) -> Self {
        Self::Failed(message)
    }
}

/// Release publicada no GitHub; `version` vem sem o `v` da tag.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AvailableUpdate {
    pub version: String,
    pub url: String,
}

/// Resultado de uma verificação, devolvido à tela de configurações.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheck {
    pub current_version: String,
    pub latest_version: String,
    pub url: String,
    pub newer: bool,
}

/// `X.Y.Z` com `v` opcional; o sufixo depois de `-` ou `+` é ignorado.
fn parse_version(text: &str) -> Option<(u64, u64, u64)> {
    let text = text.strip_prefix('v').unwrap_or(text);
    let core = text.split(['-', '+']).next()?;
    let mut parts = core.split('.');
    let mut number = || {
        let part = parts.next()?;
        if part.is_empty() || !part.bytes().all(|byte| byte.is_ascii_digit()) {
            return None;
        }
        part.parse::<u64>().ok()
    };
    let version = (number()?, number()?, number()?);
    parts.next().is_none().then_some(version)
}

/// Lê a resposta de `releases/latest`. A tag precisa ser exatamente `vX.Y.Z` e o
/// endereço precisa apontar para as releases do CSTM: o texto vem de fora e acaba
/// aberto no navegador.
fn parse_release(json: &str) -> Result<AvailableUpdate, String> {
    const UNEXPECTED: &str = "resposta inesperada do GitHub";
    let value: serde_json::Value = serde_json::from_str(json).map_err(|_| UNEXPECTED)?;
    let tag = value["tag_name"].as_str().ok_or(UNEXPECTED)?;
    let url = value["html_url"].as_str().ok_or(UNEXPECTED)?;
    let version = tag.strip_prefix('v').ok_or(UNEXPECTED)?;
    if tag.contains(['-', '+']) || parse_version(tag).is_none() || !is_release_url(url) {
        return Err(UNEXPECTED.into());
    }
    Ok(AvailableUpdate {
        version: version.to_string(),
        url: url.to_string(),
    })
}

/// Se `latest` é numericamente maior que `current`; versão inválida nunca é mais nova.
fn is_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some(latest), Some(current)) => latest > current,
        _ => false,
    }
}

/// Se já passou o intervalo desde a última verificação. Um relógio que voltou no tempo
/// (última verificação no futuro) também conta como vencido.
fn is_due(last_check: Option<i64>, now: i64, interval_days: u32) -> bool {
    match last_check {
        None => true,
        Some(last) => last > now || now - last >= i64::from(interval_days) * SECONDS_PER_DAY,
    }
}

/// Endereço dentro das releases do CSTM, o único que `open_release` aceita abrir.
pub fn is_release_url(url: &str) -> bool {
    url.starts_with(RELEASES_PREFIX) && !url.contains(|c: char| c.is_whitespace() || c == '"')
}

fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs() as i64)
}

/// Horário (Unix, segundos) em que o limite de consultas volta. `retry-after` tem
/// prioridade; senão vale `x-ratelimit-reset` quando `x-ratelimit-remaining` é `0`.
/// Valores não numéricos resultam em `None`.
fn retry_at(
    now: i64,
    retry_after: Option<&str>,
    remaining: Option<&str>,
    reset: Option<&str>,
) -> Option<i64> {
    if let Some(seconds) = retry_after {
        let seconds = seconds.trim().parse::<u32>().ok()?;
        return Some(now.saturating_add(i64::from(seconds)));
    }
    if remaining?.trim() != "0" {
        return None;
    }
    reset?.trim().parse::<u32>().ok().map(i64::from)
}

/// Mensagem do limite de consultas; os minutos são arredondados para cima, mínimo 1.
fn rate_limit_message(now: i64, retry_at: Option<i64>) -> String {
    let Some(retry_at) = retry_at else {
        return "limite de consultas do GitHub atingido, tente mais tarde".into();
    };
    let minutes = (((retry_at - now).max(0) + 59) / 60).max(1);
    let unit = if minutes == 1 { "minuto" } else { "minutos" };
    format!("limite de consultas do GitHub atingido, tente de novo em {minutes} {unit}")
}

/// Espera até a próxima rodada da thread: depois de um limite com horário conhecido,
/// até a folga após o retorno dele (entre 1 min e 1 h); nos demais casos, o intervalo fixo.
fn next_wait(now: i64, retry_at: Option<i64>) -> Duration {
    match retry_at {
        Some(at) => {
            let secs = (at + RATE_LIMIT_MARGIN_SECS - now)
                .clamp(MIN_RETRY_WAIT_SECS, LOOP_INTERVAL.as_secs() as i64);
            Duration::from_secs(secs as u64)
        }
        None => LOOP_INTERVAL,
    }
}

/// Consulta a última release no GitHub. Os erros são mensagens curtas para o usuário.
fn fetch_latest(current_version: &str) -> Result<AvailableUpdate, CheckError> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(REQUEST_TIMEOUT))
        .http_status_as_error(false)
        .build()
        .into();
    let mut response = agent
        .get(LATEST_URL)
        .header("User-Agent", format!("CSTM/{current_version}"))
        .header("Accept", "application/vnd.github+json")
        .call()
        .map_err(|_| CheckError::Failed("sem conexão com o GitHub".into()))?;
    let code = response.status().as_u16();
    match code {
        200 => {}
        404 => return Err(CheckError::Failed("nenhuma versão publicada".into())),
        403 | 429 => {
            let header = |name: &str| {
                response
                    .headers()
                    .get(name)
                    .and_then(|value| value.to_str().ok())
            };
            let retry_at = retry_at(
                now(),
                header("retry-after"),
                header("x-ratelimit-remaining"),
                header("x-ratelimit-reset"),
            );
            // Um 403 sem indício de limite é um erro comum; o 429 é sempre limite.
            if code == 429 || retry_at.is_some() {
                return Err(CheckError::RateLimited { retry_at });
            }
            return Err(CheckError::Failed(format!(
                "o GitHub respondeu com o código {code}"
            )));
        }
        code => {
            return Err(CheckError::Failed(format!(
                "o GitHub respondeu com o código {code}"
            )));
        }
    }
    let body = response
        .body_mut()
        .read_to_string()
        .map_err(|_| CheckError::Failed("sem conexão com o GitHub".into()))?;
    Ok(parse_release(&body)?)
}

/// Verifica agora, grava o resultado e, se houver versão nova ainda não dispensada,
/// avisa a janela principal. Não segura o banco durante a requisição.
pub fn check(app: &AppHandle) -> Result<UpdateCheck, String> {
    check_detailed(app).map_err(|error| error.message(now()))
}

/// Como `check`, mas preserva o tipo do erro para a thread reagendar após um limite.
fn check_detailed(app: &AppHandle) -> Result<UpdateCheck, CheckError> {
    let current = app.package_info().version.to_string();
    let latest = fetch_latest(&current)?;
    let state = app.state::<Mutex<Connection>>();
    let dismissed = {
        let conn = state.lock().unwrap_or_else(PoisonError::into_inner);
        let db_error = |error: crate::db::DbError| CheckError::Failed(error.to_string());
        settings::set_update_last_check(&conn, now()).map_err(db_error)?;
        settings::set_update_latest(&conn, &latest).map_err(db_error)?;
        settings::get_update_dismissed(&conn).map_err(db_error)?
    };
    let newer = is_newer(&latest.version, &current);
    if newer && dismissed.as_deref() != Some(latest.version.as_str()) {
        let _ = app.emit_to("main", AVAILABLE_EVENT, &latest);
    }
    Ok(UpdateCheck {
        current_version: current,
        latest_version: latest.version,
        url: latest.url,
        newer,
    })
}

/// Versão nova já encontrada e ainda não dispensada, para a barra de aviso.
pub fn available(conn: &Connection, current_version: &str) -> Option<AvailableUpdate> {
    let latest = settings::get_update_latest(conn).ok()??;
    let dismissed = settings::get_update_dismissed(conn).ok()?;
    (is_newer(&latest.version, current_version)
        && dismissed.as_deref() != Some(latest.version.as_str()))
    .then_some(latest)
}

/// Inicia a verificação periódica em segundo plano.
pub fn start(app: &AppHandle) {
    let app = app.clone();
    let _ = thread::Builder::new()
        .name("update-check".into())
        .spawn(move || {
            // Espera a inicialização terminar para a consulta não competir com ela.
            thread::sleep(STARTUP_DELAY);
            loop {
                thread::sleep(run_scheduled(&app));
            }
        });
}

/// Uma rodada da thread: verifica se estiver ligado e vencido e avisa uma vez por versão.
/// Falhas são silenciosas; a próxima rodada tenta de novo. Devolve a espera até ela.
/// Uma consulta que falhou não grava `update_last_check`, então `is_due` segue verdadeiro
/// e a rodada reagendada após um limite consulta de novo.
fn run_scheduled(app: &AppHandle) -> Duration {
    let state = app.state::<Mutex<Connection>>();
    let (config, last_check) = {
        let conn = state.lock().unwrap_or_else(PoisonError::into_inner);
        let config = settings::get_update_settings(&conn);
        let last_check = settings::get_update_last_check(&conn);
        match (config, last_check) {
            (Ok(config), Ok(last_check)) => (config, last_check),
            _ => return LOOP_INTERVAL,
        }
    };
    if !config.enabled || !is_due(last_check, now(), config.interval_days) {
        return LOOP_INTERVAL;
    }
    let result = match check_detailed(app) {
        Ok(result) => result,
        Err(CheckError::RateLimited { retry_at }) => return next_wait(now(), retry_at),
        Err(CheckError::Failed(_)) => return LOOP_INTERVAL,
    };
    if !result.newer {
        return LOOP_INTERVAL;
    }
    let notified = {
        let conn = state.lock().unwrap_or_else(PoisonError::into_inner);
        settings::get_update_notified(&conn).ok().flatten()
    };
    if notified.as_deref() == Some(result.latest_version.as_str()) {
        return LOOP_INTERVAL;
    }
    if show_toast(app, &result.latest_version, &result.url).is_ok() {
        let conn = state.lock().unwrap_or_else(PoisonError::into_inner);
        let _ = settings::set_update_notified(&conn, &result.latest_version);
    }
    LOOP_INTERVAL
}

/// Escapa o texto para uso em XML.
#[cfg_attr(not(windows), allow(dead_code))]
fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg_attr(not(windows), allow(dead_code))]
fn toast_xml(version: &str, url: &str) -> String {
    format!(
        "<toast activationType=\"protocol\" launch=\"{}\"><visual><binding template=\"ToastGeneric\">\
         <text>CSTM {} disponível</text><text>Clique para abrir a página da release.</text>\
         </binding></visual></toast>",
        escape_xml(url),
        escape_xml(version)
    )
}

/// Notificação do Windows. Com `activationType="protocol"` o próprio Windows abre a URL
/// ao clicar, sem tratamento no aplicativo (que pode nem estar em primeiro plano). O AUMID
/// é o `identifier` do aplicativo, o mesmo que o instalador NSIS grava no atalho do menu
/// Iniciar; sem esse atalho o Windows não exibe a notificação.
#[cfg(windows)]
fn show_toast(app: &AppHandle, version: &str, url: &str) -> windows::core::Result<()> {
    use windows::Data::Xml::Dom::XmlDocument;
    use windows::UI::Notifications::{ToastNotification, ToastNotificationManager};
    use windows::core::HSTRING;

    let document = XmlDocument::new()?;
    document.LoadXml(&HSTRING::from(toast_xml(version, url)))?;
    let toast = ToastNotification::CreateToastNotification(&document)?;
    let notifier = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(
        app.config().identifier.as_str(),
    ))?;
    notifier.Show(&toast)
}

#[cfg(not(windows))]
fn show_toast(_app: &AppHandle, _version: &str, _url: &str) -> Result<(), ()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const RELEASE_URL: &str = "https://github.com/marinsgabriel1997/CSTM/releases/tag/v0.19.0";

    #[test]
    fn parses_versions_with_optional_prefix_and_suffix() {
        assert_eq!(parse_version("0.18.0"), Some((0, 18, 0)));
        assert_eq!(parse_version("v1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_version("0.18.0-teste-087"), Some((0, 18, 0)));
        assert_eq!(parse_version("1.0.0+build.5"), Some((1, 0, 0)));
    }

    #[test]
    fn rejects_malformed_versions() {
        for text in [
            "", "1.2", "1.2.3.4", "a.b.c", "1..3", "v", "-1.2.3", "1.2.x",
        ] {
            assert_eq!(parse_version(text), None, "{text}");
        }
    }

    #[test]
    fn parses_a_release_response() {
        let json = format!(r#"{{"tag_name":"v0.19.0","html_url":"{RELEASE_URL}","draft":false}}"#);
        assert_eq!(
            parse_release(&json),
            Ok(AvailableUpdate {
                version: "0.19.0".into(),
                url: RELEASE_URL.into()
            })
        );
    }

    #[test]
    fn rejects_unexpected_release_responses() {
        let unexpected = Err("resposta inesperada do GitHub".to_string());
        for json in [
            "não é json".to_string(),
            "{}".to_string(),
            format!(r#"{{"tag_name":"0.19.0","html_url":"{RELEASE_URL}"}}"#),
            format!(r#"{{"tag_name":"v0.19.0-beta.1","html_url":"{RELEASE_URL}"}}"#),
            format!(r#"{{"tag_name":"v0.19","html_url":"{RELEASE_URL}"}}"#),
            r#"{"tag_name":"v0.19.0","html_url":"https://evil.com/releases/"}"#.to_string(),
            r#"{"tag_name":"v0.19.0"}"#.to_string(),
        ] {
            assert_eq!(parse_release(&json), unexpected, "{json}");
        }
    }

    #[test]
    fn compares_versions_numerically() {
        assert!(is_newer("0.19.0", "0.18.9"));
        assert!(is_newer("0.10.0", "0.9.0"));
        assert!(is_newer("1.0.0", "0.99.99"));
        assert!(!is_newer("0.18.0", "0.18.0"));
        assert!(!is_newer("0.17.0", "0.18.0"));
        assert!(!is_newer("0.18.0", "0.18.0-teste-087"));
        assert!(is_newer("0.19.0", "0.18.0-teste-087"));
        assert!(!is_newer("lixo", "0.18.0"));
        assert!(!is_newer("0.19.0", "lixo"));
    }

    #[test]
    fn due_when_never_checked_or_interval_elapsed() {
        let day = SECONDS_PER_DAY;
        assert!(is_due(None, 1_000, 7));
        assert!(!is_due(Some(1_000), 1_000 + 7 * day - 1, 7));
        assert!(is_due(Some(1_000), 1_000 + 7 * day, 7));
        assert!(is_due(Some(1_000), 1_000 + 30 * day, 7));
        assert!(is_due(Some(5_000), 1_000, 7), "relógio voltou no tempo");
    }

    #[test]
    fn retry_at_uses_retry_after_first() {
        assert_eq!(retry_at(1_000, Some("120"), None, None), Some(1_120));
        assert_eq!(
            retry_at(1_000, Some("120"), Some("0"), Some("5000")),
            Some(1_120),
            "retry-after vence o reset"
        );
    }

    #[test]
    fn retry_at_uses_reset_only_when_remaining_is_zero() {
        assert_eq!(retry_at(1_000, None, Some("0"), Some("5000")), Some(5_000));
        assert_eq!(retry_at(1_000, None, Some("3"), Some("5000")), None);
        assert_eq!(retry_at(1_000, None, None, Some("5000")), None);
        assert_eq!(retry_at(1_000, None, Some("0"), None), None);
        assert_eq!(retry_at(1_000, None, None, None), None);
    }

    #[test]
    fn retry_at_rejects_invalid_values() {
        assert_eq!(retry_at(1_000, Some("abc"), None, None), None);
        assert_eq!(retry_at(1_000, Some("-5"), None, None), None);
        assert_eq!(retry_at(1_000, None, Some("0"), Some("x")), None);
        assert_eq!(retry_at(1_000, None, Some("x"), Some("5000")), None);
    }

    #[test]
    fn next_wait_adds_margin_and_clamps() {
        assert_eq!(next_wait(1_000, Some(1_600)), Duration::from_secs(630));
        assert_eq!(next_wait(1_000, Some(1_000)), Duration::from_secs(60));
        assert_eq!(next_wait(1_000, Some(500)), Duration::from_secs(60));
        assert_eq!(next_wait(0, Some(3_570)), Duration::from_secs(3_600));
        assert_eq!(next_wait(0, Some(90_000)), Duration::from_secs(3_600));
        assert_eq!(next_wait(1_000, None), LOOP_INTERVAL);
    }

    #[test]
    fn rate_limit_message_rounds_minutes_up() {
        let prefix = "limite de consultas do GitHub atingido";
        assert_eq!(
            rate_limit_message(0, None),
            format!("{prefix}, tente mais tarde")
        );
        assert_eq!(
            rate_limit_message(0, Some(1)),
            format!("{prefix}, tente de novo em 1 minuto")
        );
        assert_eq!(
            rate_limit_message(0, Some(60)),
            format!("{prefix}, tente de novo em 1 minuto")
        );
        assert_eq!(
            rate_limit_message(0, Some(61)),
            format!("{prefix}, tente de novo em 2 minutos")
        );
        assert_eq!(
            rate_limit_message(100, Some(50)),
            format!("{prefix}, tente de novo em 1 minuto"),
            "horário já passado"
        );
        assert_eq!(
            CheckError::RateLimited {
                retry_at: Some(600)
            }
            .message(0),
            format!("{prefix}, tente de novo em 10 minutos")
        );
    }

    #[test]
    fn accepts_only_cstm_release_urls() {
        assert!(is_release_url(RELEASE_URL));
        assert!(is_release_url(
            "https://github.com/marinsgabriel1997/CSTM/releases/"
        ));
        for url in [
            "https://github.com/outro/repo/releases/x",
            "https://evil.com/https://github.com/marinsgabriel1997/CSTM/releases/",
            "https://github.com/marinsgabriel1997/CSTM/releases.evil.com",
            "https://github.com/marinsgabriel1997/CSTM/releases",
            "http://github.com/marinsgabriel1997/CSTM/releases/x",
            "https://github.com/marinsgabriel1997/CSTM/releases/x y",
            "https://github.com/marinsgabriel1997/CSTM/releases/x\"y",
            "",
        ] {
            assert!(!is_release_url(url), "{url}");
        }
    }

    #[test]
    fn toast_xml_escapes_its_values() {
        let xml = toast_xml("1.0.0", "https://x/?a=1&b=\"2\"");
        assert!(xml.contains("launch=\"https://x/?a=1&amp;b=&quot;2&quot;\""));
        assert!(xml.contains("<text>CSTM 1.0.0 disponível</text>"));
        assert_eq!(escape_xml("<a & 'b'>"), "&lt;a &amp; &apos;b&apos;&gt;");
    }
}
