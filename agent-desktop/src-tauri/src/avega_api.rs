use chrono::Utc;
use reqwest::{Client, Response};
use serde::Serialize;
use serde_json::Value;

const AVEGA_API_BASE_URL: &str = "https://api.avegabros.org";
const AVEGA_API_KEY: &str = match option_env!("AVEGA_WEBSITE_API_KEY") {
    Some(v) => v,
    None => "tMxLOAEnad9heg7fpIZWQrm2F",
};

#[derive(Debug, Clone, Serialize)]
pub struct AvegaOption {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AvegaEmployee {
    pub id: i64,
    pub name: String,
    pub company_id: Option<i64>,
    pub department_id: Option<i64>,
}

fn collect_rows(payload: &Value) -> Vec<&Value> {
    if let Some(rows) = payload.as_array() {
        return rows.iter().collect();
    }

    if let Some(obj) = payload.as_object() {
        for key in ["data", "result", "rows", "items", "records", "list"] {
            if let Some(rows) = obj.get(key).and_then(Value::as_array) {
                return rows.iter().collect();
            }
        }
    }

    Vec::new()
}

fn read_i64(value: &Value, keys: &[&str]) -> Option<i64> {
    let obj = value.as_object()?;
    for key in keys {
        if let Some(raw) = obj.get(*key) {
            if let Some(id) = raw.as_i64() {
                return Some(id);
            }
            if let Some(text) = raw.as_str() {
                if let Ok(parsed) = text.trim().parse::<i64>() {
                    return Some(parsed);
                }
            }
        }
    }
    None
}

fn read_string(value: &Value, keys: &[&str]) -> Option<String> {
    let obj = value.as_object()?;
    for key in keys {
        if let Some(raw) = obj.get(*key).and_then(Value::as_str) {
            let trimmed = raw.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn parse_options(payload: &Value, id_keys: &[&str], name_keys: &[&str]) -> Vec<AvegaOption> {
    collect_rows(payload)
        .into_iter()
        .filter_map(|row| {
            let id = read_i64(row, id_keys)?;
            let name = read_string(row, name_keys)?;
            Some(AvegaOption { id, name })
        })
        .collect()
}

fn parse_employees(payload: &Value) -> Vec<AvegaEmployee> {
    collect_rows(payload)
        .into_iter()
        .filter_map(|row| {
            let id = read_i64(row, &["id", "employee_id", "requestor_id"])?;
            let name = read_string(
                row,
                &[
                    "name",
                    "employee",
                    "employee_name",
                    "full_name",
                    "fullname",
                    "requestor",
                ],
            )?;

            Some(AvegaEmployee {
                id,
                name,
                company_id: read_i64(row, &["company_id"]),
                department_id: read_i64(row, &["department_id"]),
            })
        })
        .collect()
}

fn extract_error_message(payload: &Value) -> Option<String> {
    if let Some(msg) = read_string(payload, &["message", "error", "detail"]) {
        return Some(msg);
    }

    if let Some(obj) = payload.as_object() {
        for key in ["data", "result", "errors"] {
            if let Some(value) = obj.get(key) {
                if let Some(msg) = extract_error_message(value) {
                    return Some(msg);
                }
            }
        }
    }

    None
}

fn extract_token(payload: &Value) -> Option<String> {
    if let Some(token) = read_string(
        payload,
        &[
            "token",
            "access_token",
            "accessKey",
            "access_key",
            "auth_token",
            "authToken",
            "authorization",
        ],
    ) {
        return Some(token);
    }

    if let Some(obj) = payload.as_object() {
        for key in ["data", "result", "user"] {
            if let Some(value) = obj.get(key) {
                if let Some(token) = extract_token(value) {
                    return Some(token);
                }
            }
        }
    }

    None
}

async fn parse_response(response: Response) -> Result<Value, String> {
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read API response: {e}"))?;

    let payload: Value = serde_json::from_str(&body).unwrap_or_else(|_| Value::Null);

    if status.is_success() {
        return Ok(payload);
    }

    let message = extract_error_message(&payload)
        .unwrap_or_else(|| format!("Request failed with status {status}"));

    Err(format!("HTTP_{}: {message}", status.as_u16()))
}

fn authenticated_client(token: &str) -> Result<Client, String> {
    let bearer = format!("Bearer {}", token.trim());
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::AUTHORIZATION,
        reqwest::header::HeaderValue::from_str(&bearer)
            .map_err(|e| format!("Invalid authorization token: {e}"))?,
    );

    Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))
}

#[tauri::command]
pub async fn avega_login(username: String, password: String) -> Result<String, String> {
    if username.trim().is_empty() || password.is_empty() {
        return Err("Username and password are required.".to_string());
    }

    let client = Client::new();
    let url = format!(
        "{}/website/auth-login?key={}",
        AVEGA_API_BASE_URL, AVEGA_API_KEY
    );

    let response = client
        .post(url)
        .json(&serde_json::json!({
            "username": username.trim(),
            "password": password,
        }))
        .send()
        .await
        .map_err(|e| format!("Authentication request failed: {e}"))?;

    let payload = parse_response(response).await?;
    extract_token(&payload).ok_or_else(|| "Login succeeded but no token was returned.".to_string())
}

#[tauri::command]
pub async fn avega_get_companies(token: String) -> Result<Vec<AvegaOption>, String> {
    let client = authenticated_client(&token)?;
    let url = format!(
        "{}/website/companies?key={}",
        AVEGA_API_BASE_URL, AVEGA_API_KEY
    );

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to load companies: {e}"))?;

    let payload = parse_response(response).await?;
    Ok(parse_options(&payload, &["id", "company_id"], &["name", "company"]))
}

#[tauri::command]
pub async fn avega_get_departments(token: String) -> Result<Vec<AvegaOption>, String> {
    let client = authenticated_client(&token)?;
    let url = format!(
        "{}/website/departments?key={}",
        AVEGA_API_BASE_URL, AVEGA_API_KEY
    );

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to load departments: {e}"))?;

    let payload = parse_response(response).await?;
    Ok(parse_options(
        &payload,
        &["id", "department_id"],
        &["name", "department"],
    ))
}

#[tauri::command]
pub async fn avega_get_employees(token: String) -> Result<Vec<AvegaEmployee>, String> {
    let client = authenticated_client(&token)?;
    let url = format!(
        "{}/website/employees?key={}",
        AVEGA_API_BASE_URL, AVEGA_API_KEY
    );

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to load employees: {e}"))?;

    let payload = parse_response(response).await?;
    Ok(parse_employees(&payload))
}

#[tauri::command]
pub async fn avega_submit_ticket(
    token: String,
    department_id: i64,
    company_id: i64,
    requestor_id: i64,
    requestor: String,
    request: String,
) -> Result<(), String> {
    if requestor.trim().is_empty() {
        return Err("Employee name is required.".to_string());
    }
    if request.trim().is_empty() {
        return Err("Ticket request is required.".to_string());
    }

    let client = authenticated_client(&token)?;
    let url = format!(
        "{}/website/tickets?key={}",
        AVEGA_API_BASE_URL, AVEGA_API_KEY
    );

    let payload = serde_json::json!({
        "department_id": department_id,
        "company_id": company_id,
        "requestor_id": requestor_id,
        "requestor": requestor.trim(),
        "request": request.trim(),
        "request_type": "Other",
        "priority_level": "Low",
        "request_date": Utc::now().format("%Y-%m-%d").to_string(),
    });

    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to submit ticket: {e}"))?;

    let _ = parse_response(response).await?;
    Ok(())
}
