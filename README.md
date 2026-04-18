**OptiFlow AI: Smart Traffic Signal Optimization**

**Dynamic Multi-Criteria Decision Analysis for Urban Congestion**

OptiFlow AI is a smart city solution designed to replace static, timer-based traffic signals with an intelligent, density-aware system. By utilizing real-time data and explainable AI, OptiFlow ensures that emergency vehicles are never delayed and urban congestion is minimized.

**🚦 The Problem**

- **Economic Impact:** India loses ₹1.47 lakh crore annually to traffic congestion (MORTH 2023).
- **Life Safety:** Every 10-minute delay in emergency response reduces survival chances by 10% (WHO).
- **Static Inefficiency:** Current signals operate on fixed cycles and cannot distinguish between varying vehicle densities.

**✨ Our Solution: OptiFlow**

- **Density-Based Timing:** Dynamic green light duration based on real-time lane density instead of fixed cycles.
- **Emergency Priority Preemption:** Instant signal override for emergency vehicles using a strict triage hierarchy: **Ambulance > Fire > Police**.
- **Multi-Triage Sequencing:** A Master Sequencer handles multiple simultaneous emergencies, clearing them one-by-one before resuming normal flow.
- **Explainable AI (XAI):** Every decision is logged and explained in plain language, providing a full audit trail for city administrators.

**🛠️ Technical Stack**

- **Simulation:** Real-time environment tracking vehicle count, lane density, and vehicle types.
- **AI Diagnostics:** LLM integration for generating human-readable reasoning for signal changes.
- **Dashboard:** Live junction mapping, load waveforms, and junction stability monitoring.
- **Protocols:** Built on the Round Robin scheduling algorithm and NEMA TS2 standards.

**📈 Impact (Simulation Results)**

- **Reduced Wait Times:** Average junction wait time dropped to **6 seconds**, compared to 45-90 seconds for static signals.
- **Stability:** Maintained a 13% junction load even during multi-emergency scenarios
