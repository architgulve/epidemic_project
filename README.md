# EpidemicNODE

**Individual-Level Epidemic Forecasting via Graph Neural ODEs**

EpidemicNODE is a Graph Neural Network (GNN) and Neural Ordinary Differential Equation (NODE) based epidemic forecasting framework that predicts disease progression at the individual level. Instead of modeling populations as homogeneous groups, EpidemicNODE represents every individual as a node in a heterogeneous contact graph and learns disease dynamics through a physics-constrained Graph Neural ODE architecture. The project includes synthetic population generation, graph construction, epidemic simulation, model training, a FastAPI backend, and an interactive React visualization dashboard.

The framework was developed as part of research conducted at the Indian Institute of Information Technology Pune and is described in the accompanying IEEE conference paper.

---

## Features

* Individual-level SEIRD epidemic forecasting
* Heterogeneous contact graph generation
* Graph Neural ODE architecture using GATv2
* Physics-informed epidemic constraints
* Synthetic population generation with demographic realism
* Intervention simulation

  * Mask mandates
  * School closures
  * Lockdowns
  * Zone-specific policies
* Interactive epidemic visualization dashboard
* Zone-level risk analytics and hotspot detection
* Streaming inference through FastAPI

---

## Repository Structure

```text
.
├── api/
│   └── main.py                 # FastAPI inference server
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── utils/
│   │   └── store.js
│   └── public/
│
├── notebooks/
│   ├── 01_generate_population.ipynb
│   ├── 02_build_graphs.ipynb
│   ├── 03_seird_simulation.ipynb
│   ├── 04_train_tgn.ipynb
│   └── 05_api_server.ipynb
│
├── graphs/                     # Generated graph snapshots
├── model/                      # Trained EpidemicNODE weights
├── data/
│   ├── graph.pt
│   └── population.parquet
│
├── predict_payload.json
├── test_predict.py
├── test_load.py
└── README.md
```

Repository contains a complete epidemic forecasting pipeline including population generation, graph construction, simulation, model training, inference, and visualization.

---

## Methodology

### 1. Synthetic Population Generation

A synthetic population of approximately 12,000 individuals is generated with attributes including:

* Age
* Sex
* Socioeconomic status
* Social activity frequency
* Mobility score
* Vaccination status
* Comorbidity score
* Geographic zone

The population is designed to mimic realistic demographic and behavioral distributions.

---

### 2. Contact Graph Construction

The heterogeneous contact graph combines multiple interaction layers:

#### Household Layer

Fully connected household cliques.

#### Workplace / School Layer

Connections between individuals belonging to the same institution.

#### Geographic Similarity Layer

k-nearest-neighbor connections based on demographic similarity within zones.

All layers are fused into a weighted graph that preserves realistic contact patterns.

---

### 3. Epidemic Simulation

Disease spread follows an SEIRD formulation:

* Susceptible (S)
* Exposed (E)
* Infectious (I)
* Recovered (R)
* Deceased (D)

## Individual transition parameters are derived from demographic and health attributes. Infection propagation uses an Independent Cascade transmission model.

### 4. Graph Neural ODE

The forecasting model combines:

* GATv2 graph message passing
* Neural Ordinary Differential Equations
* Physics-constrained derivative functions

Constraints ensure:

* Susceptibility can only decrease
* Mortality can only increase

## These inductive biases enforce epidemiologically valid dynamics during training and inference.

## Model Architecture

```text
Node Features
      │
      ▼
GATv2 Layer
      │
      ▼
GATv2 Layer
      │
      ▼
Derivative Network
      │
      ▼
Neural ODE Solver (RK4)
      │
      ▼
SEIRD Trajectory Forecast
```

The backend implementation uses two GATv2 layers followed by a derivative head integrated using a Neural ODE solver.

---

## Backend API

### Health Check

```http
GET /health
```

Returns:

```json
{
  "status": "ok",
  "default_seed": 42
}
```

---

### Upload Initial Infection Dataset

```http
POST /api/upload
```

Upload a CSV containing:

```csv
node_id,infected
15,1
201,1
825,1
```

Response:

```json
{
  "graph_id": "abc12345",
  "n_nodes": 12000,
  "n_infected": 3
}
```

---

### Run Forecast

```http
POST /api/predict
```

Example payload:

```json
{
  "graph_id": "abc12345",
  "interventions": {
    "mask_mandate": 70,
    "school_closure": true,
    "lockdown": false
  }
}
```

The endpoint streams epidemic predictions for 30 days using Server-Sent Events (SSE).

---

## Frontend Dashboard

The React dashboard provides:

* Geographic heatmaps
* Zone analytics
* Epidemic timeline visualization
* Graph exploration
* Intervention controls
* Population statistics
* Risk hotspot analysis

Frontend components include analytics, graph visualization, maps, timelines, intervention panels, and statistics dashboards.

---

## Installation

### Backend

```bash
git clone https://github.com/<username>/EpidemicNODE.git
cd EpidemicNODE

python -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

Run server:

```bash
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

---

### Frontend

```bash
cd frontend

npm install
npm run dev
```

The dashboard will be available at:

```text
http://localhost:5173
```

---

## Research Contributions

* Individual-level epidemic prediction
* Heterogeneous contact graph generation
* Physics-constrained Graph Neural ODE architecture
* Multi-graph generalization to unseen populations
* Interactive epidemic intervention analysis

The proposed framework achieved strong generalization performance across unseen graph topologies and demonstrates the feasibility of combining Graph Neural Networks with Neural ODEs for epidemic forecasting.



---

## License

This project is intended for academic and research purposes. Please contact the authors for collaboration or usage inquiries.
---

## Demo Images
<img width="1312" height="665" alt="image" src="https://github.com/user-attachments/assets/dae0a0e7-b589-48e1-8beb-b1974d814c86" />
<img width="1312" height="665" alt="WhatsApp Image 2026-06-18 at 1 19 27 AM" src="https://github.com/user-attachments/assets/73421f47-95ed-4e53-ba30-c278fb207fa6" />


