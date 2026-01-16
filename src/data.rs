use alpm::Alpm;
use serde::Serialize;
use std::collections::{HashMap, HashSet};

#[derive(Serialize, Clone)]
pub struct Node {
    pub id: String,
    pub size: f64,       // This is for the physics/visual size
    pub size_bytes: u64, // This is the actual size for the popover
    pub repo: String,
}

#[derive(Serialize, Clone)]
pub struct Edge {
    pub source: String,
    pub target: String,
}

#[derive(Serialize, Clone)]
pub struct GraphData {
    pub nodes: Vec<Node>,
    pub links: Vec<Edge>,
}

pub fn fetch_pacman_data() -> GraphData {
    let handle = Alpm::new("/", "/var/lib/pacman").expect("Failed to open alpm");
    let db = handle.localdb();

    let mut nodes = Vec::new();
    let mut links = Vec::new();
    let mut node_set = HashSet::new();
    let mut dep_counts = HashMap::new();

    for pkg in db.pkgs() {
        for dep in pkg.depends() {
            *dep_counts.entry(dep.name().to_string()).or_insert(0) += 1;
        }
    }

    for pkg in db.pkgs() {
        let name = pkg.name().to_string();
        let hub_score = *dep_counts.get(&name).unwrap_or(&0) as f64;
        let repo = pkg.db().map(|d| d.name()).unwrap_or("unknown").to_string();

        let base_size = (pkg.isize() as f64).max(1.0).log10() * 3.0;
        let final_size = (base_size + (hub_score / 5.0)).clamp(6.0, 50.0);

        nodes.push(Node {
            id: name.clone(),
            size: final_size,
            size_bytes: pkg.isize() as u64,
            repo,
        });
        node_set.insert(name);
    }

    for pkg in db.pkgs() {
        for dep in pkg.depends() {
            let dep_name = dep.name().to_string();
            if !node_set.contains(&dep_name) {
                nodes.push(Node {
                    id: dep_name.clone(),
                    size: 4.0,
                    size_bytes: 0,
                    repo: "ghost".into(),
                });
                node_set.insert(dep_name.clone());
            }
            links.push(Edge {
                source: pkg.name().to_string(),
                target: dep_name,
            });
        }
    }

    GraphData { nodes, links }
}
