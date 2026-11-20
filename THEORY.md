# Theory and mathematics

## 1. Problem formulation

**System.** One floor of a shopping mall, modelled as a 2D region $\Omega = [0, 40] \times [0, 30]$ m. The floor is bounded by walls and contains several rectangular shop blocks that people cannot walk through. There are **two exits of equal width $w$**: one in the middle of the west wall and one in the middle of the east wall. At $t = 0$, $N$ people stand at random positions on the free floor and start evacuating.

**Question.** How wide must the exits be for the floor to empty within a target time $T_\text{target} = 180$ s, as the number of occupants rises from $N = 100$ to $N = 400$? Does the required width grow faster than occupancy?

**Quantities of interest** (each one computed for every replication $r = 1, \dots, R$):

| Quantity | Definition | Units |
|---|---|---|
| $T_\text{evac}$ | time at which the last person passes an exit | s |
| $T_{90}$ | time at which 90 % of people have left (more robust to a single straggler) | s |
| $N_\text{out}(t)$ | cumulative number of people evacuated by time $t$ | persons |
| $J_s$ | specific flow through an exit during steady discharge, $J_s = \Delta N_\text{out} / (w\,\Delta t)$ | persons m⁻¹ s⁻¹ |
| $\rho_\text{peak}$ | peak density in a half-disc of radius 2 m in front of an exit | persons m⁻² |

From these, the **required exit width** is

$$
w^*(N) = \min\left\{ w : \overline{T}_\text{evac}(N, w) + h_{95}(N, w) \le T_\text{target} \right\},
$$

where $\overline{T}_\text{evac}$ is the mean over replications and $h_{95}$ is the half-width of its 95 % confidence interval. Using the upper confidence limit means the answer is the width that meets the target *with confidence*, not just on average. It is found by linear interpolation between the simulated widths. The **scaling exponent** $\alpha$ is fitted by least squares on

$$
\log w^*(N) = \log c + \alpha \log N .
$$

If $\alpha > 1$, exit width must grow faster than occupancy. If $\alpha \approx 1$, it grows in proportion; if $\alpha < 1$, it grows more slowly.

## 2. Assumptions

1. **Two-dimensional, single floor; people are discs** of radius $r_i$. This is the standard representation in the Social Force Model [1], [2]. Stairs, escalators and other floors are out of scope.
2. **Synthetic geometry.** No real floor plan or evacuation data are available. The 40 m × 30 m floor with shop blocks and two exits represents a medium-sized single mall floor.
3. **No pre-movement time.** Everyone starts moving at $t = 0$, so $T_\text{evac}$ is a *movement* time. Real evacuations also include detection and reaction time, so real total times are longer. The required widths are therefore a lower bound.
4. **Nearest-exit routing.** Each person follows the shortest walking route to the nearest exit (a static distance map) and does not switch to a less crowded exit. The layout is symmetric, so the load on the two exits is roughly balanced.
5. **Homogeneous adult population, normal (non-panic) walking.** Desired speeds follow the walking-speed distribution measured in [1]; force constants, mass and body size come from [2]. These were measured or calibrated on non-Sri Lankan crowds and are assumed to transfer.
6. **Exits are open doorways.** A person is safe, and is removed from the simulation, once they are 0.5 m outside the exit line.
7. **The 180 s target is assumed.** It is used as a fixed design criterion.

## 3. Model equations

### 3.1 Equations of motion (Social Force Model)

Each pedestrian $i$ has position $\mathbf{x}_i$, velocity $\mathbf{v}_i$, mass $m_i$ and radius $r_i$, and obeys Newton's second law [1], [2]:

$$
\frac{d\mathbf{x}_i}{dt} = \mathbf{v}_i, \qquad
m_i \frac{d\mathbf{v}_i}{dt}
= \underbrace{m_i\,\frac{v_i^0\,\mathbf{e}_i^0(\mathbf{x}_i) - \mathbf{v}_i}{\tau}}_{\text{driving force}}
+ \sum_{j \ne i} \mathbf{f}_{ij}
+ \sum_{W} \mathbf{f}_{iW}.
$$

**Driving force.** Each person accelerates towards their desired velocity $v_i^0 \mathbf{e}_i^0$ over a relaxation time $\tau$.

**Pedestrian–pedestrian force** [2]:

$$
\mathbf{f}_{ij} = \Big[ A\, e^{(r_{ij} - d_{ij})/B} + k\, g(r_{ij} - d_{ij}) \Big]\,\mathbf{n}_{ij}
+ \kappa\, g(r_{ij} - d_{ij})\, \Delta v_{ji}^{t}\, \mathbf{t}_{ij},
$$

where

- $d_{ij} = \lVert \mathbf{x}_i - \mathbf{x}_j \rVert$ is the distance between centres;
- $r_{ij} = r_i + r_j$ is the sum of radii;
- $\mathbf{n}_{ij} = (\mathbf{x}_i - \mathbf{x}_j)/d_{ij}$ is the unit normal from $j$ to $i$;
- $\mathbf{t}_{ij} = (-n_{ij,2},\, n_{ij,1})$ is the unit tangent;
- $\Delta v_{ji}^{t} = (\mathbf{v}_j - \mathbf{v}_i)\cdot\mathbf{t}_{ij}$ is the tangential velocity difference;
- $g(x) = \max(x, 0)$, so the body-compression ($k$) and sliding-friction ($\kappa$) terms act only when the bodies overlap.

The exponential term is a soft "personal-space" repulsion that acts before contact.

**Pedestrian–wall force** [2]. Walls are line segments: the outer walls, with gaps at the exits, and the edges of every shop block. For each segment $W$, let $d_{iW}$ be the distance from $\mathbf{x}_i$ to the closest point on the segment, $\mathbf{n}_{iW}$ the unit vector from that point to $\mathbf{x}_i$, and $\mathbf{t}_{iW}$ the unit tangent. Then

$$
\mathbf{f}_{iW} = \Big[ A\, e^{(r_i - d_{iW})/B} + k\, g(r_i - d_{iW}) \Big]\,\mathbf{n}_{iW}
- \kappa\, g(r_i - d_{iW})\, (\mathbf{v}_i \cdot \mathbf{t}_{iW})\, \mathbf{t}_{iW}.
$$

**Speed cap.** After each step, if $\lVert\mathbf{v}_i\rVert > v_\text{max} = 1.3\,v_i^0$, the velocity is rescaled to $v_\text{max}$ [1].

### 3.2 Desired direction: shortest-distance map

So that people walk *around* shop blocks instead of straight into them, the desired direction comes from a distance field $D(\mathbf{x})$: the shortest walking distance from $\mathbf{x}$ to the nearest exit. $D$ approximately solves the eikonal equation

$$
\lVert \nabla D \rVert = 1 \ \text{in free space}, \qquad D = 0 \ \text{at the exits},
$$

with obstacles treated as impassable. The desired direction is the steepest-descent direction:

$$
\mathbf{e}_i^0 = -\frac{\nabla D(\mathbf{x}_i)}{\lVert \nabla D(\mathbf{x}_i) \rVert}.
$$

$D$ is computed once per geometry (once per exit width, or blocked-exit case) on a grid of spacing $h$. Obstacles are inflated by the maximum body radius so routes keep clear of corners. The calculation is a multi-source Dijkstra shortest-path search [6] from all exit cells on an 8-connected grid. $\nabla D$ is evaluated by central differences, and $\mathbf{e}^0$ is bilinearly interpolated at each person's position. Inside the exit doorway, $\mathbf{e}^0$ is the outward normal of the exit.

### 3.3 Input model (random variates)

| Input | Distribution | Sampling method | Source |
|---|---|---|---|
| Desired speed $v_i^0$ | Normal, mean 1.34 m/s, s.d. 0.26 m/s, truncated to mean ± 3 s.d. ([0.56, 2.12] m/s) | rejection sampling | [1] |
| Body radius $r_i$ | Uniform on [0.25, 0.35] m | inverse transform | [2] |
| Start position $\mathbf{x}_i(0)$ | Uniform on the free floor, with no overlaps | random sequential placement: draw uniformly, reject if inside a shop block, closer than $r_i$ to a wall, or overlapping a person already placed | assumed |
| Start velocity | $\mathbf{v}_i(0) = \mathbf{0}$ | — | assumed |

### 3.4 Symbols and parameter values

| Symbol | Meaning | Units | Value / range | Source |
|---|---|---|---|---|
| $N$ | number of occupants | persons | 100, 200, 300, 400 | assumed |
| $w$ | width of each exit | m | swept (initially 1.0–3.0) | assumed |
| $m_i$ | mass | kg | 80 | [2] |
| $\tau$ | relaxation time | s | 0.5 | [2] |
| $v_i^0$ | desired walking speed | m s⁻¹ | $\mathcal{N}(1.34,\,0.26^2)$, truncated | [1] |
| $v_\text{max}$ | maximum speed | m s⁻¹ | $1.3\,v_i^0$ | [1] |
| $r_i$ | body radius | m | $\mathcal{U}(0.25, 0.35)$ | [2] |
| $A$ | repulsion strength | N | $2 \times 10^{3}$ | [2] |
| $B$ | repulsion range | m | 0.08 | [2] |
| $k$ | body-compression coefficient | kg s⁻² | $1.2 \times 10^{5}$ | [2] |
| $\kappa$ | sliding-friction coefficient | kg m⁻¹ s⁻¹ | $2.4 \times 10^{5}$ | [2] |
| $r_c$ | interaction cut-off (centre to centre) | m | 1.3 | derived (§4.2) |
| $h$ | distance-map grid spacing | m | 0.1 | chosen |
| $\Delta t$ | time step | s | 0.01 (confirmed by convergence study) | §4.3 |
| $T_\text{max}$ | simulation time limit | s | 600 | assumed |
| $T_\text{target}$ | evacuation target | s | 180 | assumed |
| $R$ | replications (seeds) per scenario | — | ≥ 20 (full), fewer in quick mode | §4.4 |

## 4. Numerical method

### 4.1 Time integration: Velocity-Verlet with a velocity predictor

Velocity-Verlet [3], [4] advances positions and velocities by

$$
\begin{aligned}
\mathbf{x}_{n+1} &= \mathbf{x}_n + \mathbf{v}_n\,\Delta t + \tfrac12\,\mathbf{a}_n\,\Delta t^2, \\
\tilde{\mathbf{v}} &= \mathbf{v}_n + \mathbf{a}_n\,\Delta t, \\
\mathbf{a}_{n+1} &= \mathbf{F}(\mathbf{x}_{n+1}, \tilde{\mathbf{v}}) / m, \\
\mathbf{v}_{n+1} &= \mathbf{v}_n + \tfrac12\left(\mathbf{a}_n + \mathbf{a}_{n+1}\right)\Delta t .
\end{aligned}
$$

**Why a predictor.** In standard Velocity-Verlet the force depends only on position. Here the driving force and the friction force also depend on **velocity**, so $\mathbf{a}_{n+1}$ would need the unknown $\mathbf{v}_{n+1}$, which would make the scheme implicit. The predictor $\tilde{\mathbf{v}}$ (an Euler estimate) keeps it explicit. For the velocity update this is Heun's method (explicit trapezoidal rule), which is **second-order accurate**: local error $O(\Delta t^3)$, global error $O(\Delta t^2)$.

**Accuracy on the analytic test case.** For one person in open space, $\mathbf{e}^0$ is constant and the motion reduces to $\dot v = (v_0 - v)/\tau$, with exact solution

$$
v(t) = v_0\left(1 - e^{-t/\tau}\right).
$$

Applied to this equation, the scheme multiplies the error each step by the Heun amplification factor $R(z) = 1 + z + z^2/2$ with $z = -\Delta t/\tau$. That factor matches $e^{z}$ to $O(z^3)$, so halving $\Delta t$ should cut the global error by a factor of about 4. This is verified on a log–log plot (V1, X2).

### 4.2 Neighbour search: cell lists

Computing every pair costs $O(N^2)$ per step. The exponential repulsion decays quickly, so it is truncated at a cut-off $r_c$. The surface gap $s_c$ at which the repulsion falls to about 1 N is

$$
A\, e^{-s_c/B} = 1\ \text{N} \;\Rightarrow\; s_c = B \ln(A / 1\,\text{N}) = 0.08 \ln 2000 \approx 0.61\ \text{m},
$$

so $r_c = 2 r_\text{max} + s_c \approx 0.70 + 0.61 \approx 1.3$ m. The neglected force (< 1 N per neighbour) is under 0.5 % of a typical driving force ($m v^0/\tau \approx 214$ N).

The floor is divided into square cells of side $\ell \ge r_c$ (the cell-list method [5]), and each person is assigned to a cell. Forces are then summed only over the 3 × 3 block of cells around each person, which makes the cost per step $O(N)$. The cell lists are rebuilt every step, which is cheap. The cell-list forces are checked against a brute-force $O(N^2)$ sum (V3). Walls use the same cut-off.

### 4.3 Stability and choice of time step

The scheme is explicit, so $\Delta t$ must resolve the fastest time scales in the model.

1. **Driving-force relaxation.** For $\dot v = (v_0 - v)/\tau$, Heun's method is stable for $|R(z)| \le 1$, i.e. $\Delta t \le 2\tau = 1$ s. This is never the binding limit.
2. **Body contact (stiff spring).** Two overlapping people behave like a spring of stiffness $k$ plus the slope of the exponential term at contact, $A/B$, acting on the reduced mass $m/2$. The angular frequency is

   $$
   \omega = \sqrt{\frac{2(k + A/B)}{m}} = \sqrt{\frac{2(1.2\times10^5 + 2.5\times10^4)}{80}} \approx 60\ \text{rad s}^{-1}.
   $$

   Verlet-type schemes are stable for $\omega\,\Delta t < 2$, so $\Delta t < 0.033$ s.
3. **Sliding friction.** The friction term damps tangential relative motion at rate $\gamma = 2\kappa\, g / m$, which grows with the overlap $g$. Explicit stability needs $\gamma\,\Delta t \lesssim 2$. For a 2 cm overlap, $\gamma = 120$ s⁻¹, so $\Delta t \lesssim 0.017$ s.

The production step $\Delta t = 0.01$ s satisfies all three limits with margin for typical overlaps. Two checks support this choice: a convergence study at $\Delta t$, $\Delta t/2$ and $\Delta t/4$ (V4), and a run at a deliberately too-large step that becomes unstable (V5).

*Note on convergence of a many-body system.* Crowd dynamics are chaotic: tiny differences (such as a change in $\Delta t$) eventually change the order in which people pass through an exit. Individual trajectories are therefore not expected to converge pointwise over a whole evacuation. Pointwise order is measured on the single-pedestrian test (V1, X2). For the full crowd, convergence is assessed on the **distribution** of $T_\text{evac}$ (the mean over seeds) at the three time steps (V4).

### 4.4 Monte Carlo replications and confidence intervals

Each scenario $(N, w)$ is run with $R$ independent seeds, giving $T^{(1)}, \dots, T^{(R)}$. By the law of large numbers, the sample mean $\overline{T}$ converges to $\mathbb{E}[T_\text{evac}]$. The 95 % confidence interval [9] is

$$
\overline{T} \pm t_{0.975,\,R-1}\,\frac{s}{\sqrt{R}},
\qquad s^2 = \frac{1}{R-1} \sum_{r=1}^{R} \left(T^{(r)} - \overline{T}\right)^2 .
$$

Its half-width shrinks like $R^{-1/2}$, which is also shown empirically. Seeds are fixed and listed in the notebook, so every result is reproducible. Runs that have not cleared by $T_\text{max}$ are counted and reported separately.

### 4.5 Exits and bookkeeping

A person is removed once they are 0.5 m beyond an exit line, and the evacuation time for that exit is recorded. At every step $N_\text{inside} + N_\text{out} = N$ (V2).

## 5. Verification

Results are filled in from the notebook (Section 5).

| ID | Check | Expected | Obtained | Pass? |
|---|---|---|---|---|
| V1 | Single pedestrian from rest in open space vs $v(t) = v_0(1 - e^{-t/\tau})$ | max error < $10^{-3}$ m/s at $\Delta t = 0.01$ s | *pending* | — |
| V2 | Conservation of people | $N_\text{inside} + N_\text{out} = N$ at every step of every run | *pending* | — |
| V3 | Cell-list forces vs brute-force $O(N^2)$ forces | equal to relative tolerance $10^{-10}$ | *pending* | — |
| V4 | Time-step convergence of mean $T_\text{evac}$ at $\Delta t$, $\Delta t/2$, $\Delta t/4$ | differences shrink; $\Delta t$ result within CI of $\Delta t/4$ | *pending* | — |
| V5 | Stability limit | $\Delta t$ above the bound in §4.3 gives overlaps / exploding speeds | *pending* | — |
| V6 | Plausibility of exit flow | specific flow $J_s$ within the range measured in bottleneck experiments [7], [8] | *pending* | — |
| X2 | Convergence order (log–log, single pedestrian) | slope ≈ 2 | *pending* | — |
| X3 | Blocked exit | zero flow through the blocked exit; conservation holds | *pending* | — |

![Verification plot](figures/verification.png)

## 6. Concepts applied

| Concept | Where it is used in this project |
|---|---|
| Particle-based simulation | Pedestrians as interacting particles with short-range pair forces; cell-list neighbour search with a derived cut-off (§3.1, §4.2) |
| Numerical ODE solvers | Newton's equations integrated with Velocity-Verlet / Heun; stability limits from contact stiffness and friction; second-order convergence measured on a log–log plot (§4.1, §4.3) |
| Input modelling and random variate generation | Truncated-normal desired speeds by rejection, uniform radii by inverse transform, non-overlapping random start positions (§3.3) |
| Monte Carlo and the law of large numbers | Independent replications per scenario, t-based 95 % confidence intervals, $R^{-1/2}$ shrinking of the CI half-width (§4.4) |
| Shortest-path computation | Multi-source Dijkstra on a grid to approximate the eikonal distance field that gives each person's route (§3.2) |

## 7. References

Cited here by number; full list in [REFERENCES.md](REFERENCES.md).

1. D. Helbing and P. Molnár, "Social force model for pedestrian dynamics," *Phys. Rev. E*, vol. 51, no. 5, pp. 4282–4286, 1995, doi: 10.1103/PhysRevE.51.4282.
2. D. Helbing, I. Farkas and T. Vicsek, "Simulating dynamical features of escape panic," *Nature*, vol. 407, pp. 487–490, 2000, doi: 10.1038/35035023.
3. L. Verlet, "Computer 'experiments' on classical fluids. I. Thermodynamical properties of Lennard-Jones molecules," *Phys. Rev.*, vol. 159, no. 1, pp. 98–103, 1967, doi: 10.1103/PhysRev.159.98.
4. W. C. Swope, H. C. Andersen, P. H. Berens and K. R. Wilson, "A computer simulation method for the calculation of equilibrium constants for the formation of physical clusters of molecules: Application to small water clusters," *J. Chem. Phys.*, vol. 76, no. 1, pp. 637–649, 1982, doi: 10.1063/1.442716.
5. M. P. Allen and D. J. Tildesley, *Computer Simulation of Liquids*, 2nd ed. Oxford, U.K.: Oxford Univ. Press, 2017.
6. E. W. Dijkstra, "A note on two problems in connexion with graphs," *Numer. Math.*, vol. 1, pp. 269–271, 1959, doi: 10.1007/BF01386390.
7. A. Seyfried, O. Passon, B. Steffen, M. Boltes, T. Rupprecht and W. Klingsch, "New insights into pedestrian flow through bottlenecks," *Transp. Sci.*, vol. 43, no. 3, pp. 395–406, 2009, doi: 10.1287/trsc.1090.0263.
8. T. Kretz, A. Grünebohm and M. Schreckenberg, "Experimental study of pedestrian flow through a bottleneck," *J. Stat. Mech.*, vol. 2006, P10014, 2006, doi: 10.1088/1742-5468/2006/10/P10014.
9. A. M. Law, *Simulation Modeling and Analysis*, 5th ed. New York, NY, USA: McGraw-Hill, 2015.
