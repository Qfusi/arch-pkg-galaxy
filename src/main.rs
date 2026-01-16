mod data;
mod web;

use axum::{Json, Router, extract::State, response::Html, routing::get};
use axum_embed::ServeEmbed;
use rust_embed::RustEmbed;
use std::net::SocketAddr;
use std::sync::Arc;

#[derive(RustEmbed, Clone)]
#[folder = "src/static"]
struct StaticAssets;

async fn get_json_data(State(state): State<Arc<data::GraphData>>) -> Json<data::GraphData> {
    Json(state.as_ref().clone())
}

#[tokio::main]
async fn main() {
    let shared_data = Arc::new(data::fetch_pacman_data());
    let html_content = web::get_html();

    let app = Router::new()
        .route("/", get(move || async { Html(html_content) }))
        .route("/data", get(get_json_data))
        .nest_service("/static", ServeEmbed::<StaticAssets>::new())
        .with_state(shared_data)
        .into_make_service();

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Package galaxy active at http://{}", addr);
    let _ = opener::open(format!("http://{}", addr));

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
