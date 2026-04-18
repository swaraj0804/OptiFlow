**OptiFlow AI: Prototype Documentation**

**🏗️ Architecture: The Four-Layer Approach**

**The prototype is built on a modular logic gate system to ensure zero
emergency waits:**

1.  **Input Layer: Receives simulated data regarding vehicle counts,
    lane density, and specific vehicle types from four directions.**

2.  **Base Protocol (Normal Load): Uses a Round Robin algorithm
    (standard in OS scheduling) to ensure fair green-time distribution
    for all lanes.**

3.  **Priority Override: When an emergency is detected, the Round Robin
    pauses. Vehicles are cleared based on priority (Ambulance first) or
    a \"first-come, first-served\" basis for equal priorities.**

4.  **Audit & Explainability: The system generates a timestamped,
    plain-language log for every decision, meeting the transparency
    requirements of the EU AI Act 2024.**

**🖥️ Current Prototype Features (Phase 1.0)**

-   **Real-time Dashboard: Includes a junction map and saturation
    metrics per direction.**

-   **Master Sequencer: Manages the \"Multi-Triage\" queue for
    simultaneous emergency arrivals.**

-   **Stability Monitoring: Tracks \"Junction Stability\" and \"Wait
    Time\" waveforms to prove system efficiency.**

**🚧 Known Limitations & Roadmap**

**While the \"brain\" of the system is functional in simulation, the
following steps are planned for the next phase:**

**Phase 2: Real-World Integration**

-   **Sensors: Replacing simulation data with real IoT sensors
    (estimated ₹15-25K per junction) and CCTV feeds.**

-   **V2I Communication: Implementing transponders in emergency vehicles
    so they can broadcast their approach in advance.**

-   **Edge Compute: Deploying dedicated units (₹30-50K) for local,
    low-latency processing at the junction.**

-   **Predictive Modeling: Utilizing historical data to anticipate
    traffic surges and adjust signals proactively.**

**⚖️ Research Basis**

-   **Scheduling: Silberschatz, *OS Concepts*.**

-   **Preemption: NEMA TS2 Standard.**

-   **Guidelines: WHO Emergency Guidelines.**
