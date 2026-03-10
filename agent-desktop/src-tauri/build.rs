fn main() {
    tauri_build::build();
    
    // Embed environment variables at compile time
    // These are set by the build scripts and should be baked into the binary
    if let Ok(server_url) = std::env::var("SIGHT_SERVER_URL") {
        println!("cargo:rustc-env=COMPILED_SERVER_URL={}", server_url);
    }
    
    if let Ok(fallback_url) = std::env::var("SIGHT_FALLBACK_URL") {
        println!("cargo:rustc-env=COMPILED_FALLBACK_URL={}", fallback_url);
    }
}
