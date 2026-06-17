# EpidemicNODE: Individual-Level Epidemic Forecasting via Graph Neural ODEs


[![Framework: PyTorch](https://img.shields.io/badge/Framework-PyTorch-orange.svg)](https://pytorch.org/)

EpidemicNODE is an end-to-end differentiable framework for individual-level epidemic forecasting. By integrating **Neural Ordinary Differential Equations (NODEs)** with **Heterogeneous Contact Graphs**, EpidemicNODE tracks and models the dynamic health state transitions (SEIRD) of individual nodes over time while enforcing structural epidemiological inductive biases directly through its architecture.

Unlike traditional regional-aggregation models (e.g., EpiGNN, STAN), EpidemicNODE works on fine-grained individual-level trajectories ($P_S, P_E, P_I, P_R, P_D$) over long horizons, ensuring accurate forecasts and zero-shot generalization across unseen network topologies.

---

## 🚀 Key Features

* **Individual-Level Resolution:** Predicts the exact 5-compartment continuous probability vector for **every single individual node** over a 30-day projection horizon.
* **Demographically Grounded Graphs:** Fuses demographic features with high-fidelity synthetic contact networks ($N \approx 12,000$) where social connectivity follows realistic Power-Law and Zipfian distributions.
* **Physics-Informed Architecture:** Enforces epidemiological constraints via specialized derivative heads (such as ensuring monotonic decay for Susceptible fractions $dS/dt \le 0$ and monotonic growth for Deceased fractions $dD/dt \ge 0$).
* **Zero-Shot Generalization:** Generalizes completely out-of-the-box to unseen network topologies, structural properties, and populations without requiring retraining.

---

## 🏗️ Architecture Overview

EpidemicNODE updates individual states continuously by executing message-passing operations on a graph and feeding the calculated spatial derivatives into an ordinary differential equation (ODE) solver.

```text
       ┌────────────────────────────────────────────────────────┐
       │                 INPUT COMPONENT VECTORS                │
       │  Dynamic State X_i(t) [5]  │  Static Demographics v_i [9]│
       └─────────────────────────┬──┴───────────────────────────┘
                                 │
                                 ▼
       ┌────────────────────────────────────────────────────────┐
       │             GRAPH NEURAL NETWORK (SPATIAL)             │
       │  GATv2 Layer 1 (32 Dim, 2 Heads, Dropout: 0.20)        │
       │                           │                            │
       │  GATv2 Layer 2 (32 Dim, 2 Heads, Non-Concat)           │
       └─────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
       ┌────────────────────────────────────────────────────────┐
       │           CONTINUOUS DERIVATIVE EXTRACTOR              │
       │  MLP Layer 1 (64 Hidden Nodes + Tanh Activation)       │
       │                           │                            │
       │  MLP Layer 2 (Output Projection Map)                   │
       └─────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
       ┌────────────────────────────────────────────────────────┐
       │         PHYSICS-INFORMED RECTIFICATION HEAD            │
       │  Softplus Constraint Transformations                   │
       │  [Enforces Monotonic Strictness: dS/dt <= 0, dD/dt >= 0]│
       └─────────────────────────┬──────────────────────────────┘
                                 │  f(X_i(t), t) [Derivatives]
                                 ▼
       ┌────────────────────────────────────────────────────────┐
       │               NUMERICAL INTEGRATION BLOCK              │
       │  torchdiffeq ODE Solver (Fourth-Order Runge-Kutta / RK4)│
       │  Constant-Memory Backpropagation via Adjoint Method    │
       └─────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
       ┌────────────────────────────────────────────────────────┐
       │                OUTPUT FORECAST HORIZON                 │
       │  Updated Probability Trajectory Forecasts: X_i(t + 1)  │
       └────────────────────────────────────────────────────────┘
```
## 📊 Hyperparameter Configuration

The model is pre-configured with the optimized parameters described in the primary research paper:

| Hyperparameter | Value | Description |
| :--- | :--- | :--- |
| **Node feature dimension** | `9` | Dimensions of the continuous/static demographic array. |
| **GATv2 hidden dim** | `32 per head` | Intermediary channel layout per layer. |
| **GATv2 attention heads** | `2` | Number of multi-head structures (`concat=False`). |
| **GATv2 layers** | `2` | Graph attention message-passing depth. |
| **Derivative MLP layers** | `2` | Hidden nodes: 64, with `Tanh` activation function. |
| **ODE solver** | `RK4` | Fourth-order Runge-Kutta method, step size = `1.0`. |
| **Learning rate ($\eta$)** | `3e-4` | Initial coefficient managed via Cosine Annealing. |
| **Weight decay ($\lambda$)** | `1e-5` | Controlled AdamW regularizer factor. |
| **Gradient clip** | `< 1.0` | Maximum absolute L2 norm threshold. |
| **Feature dropout** | `0.20` | Dynamic edge feature masking probability. |
| **Batch size** | `1 graph` | Single whole-population computational graph execution. |
| **Epochs** | `100` | Target length of total operational cycle training. |
| **TF decay start epoch** | `30` | Linearly decays Teacher Forcing until Epoch 100. |

---

## 🛠️ Project Structure

```text
├── simulator/
│   └── seird_sim.py         # Stochastic Independent Cascade SEIRD simulator
├── models/
│   ├── layers.py            # Neural network layers (GATv2, MLP layers)
│   └── epidemic_node.py     # Continuous derivative blocks & physical bound heads
├── train.py                 # Core initialization, training loops, and loss monitoring
├── evaluate.py              # Zero-shot validation suite across alternate graph layouts
├── requirements.txt         # Package configuration prerequisites
└── README.md                # Project documentation
