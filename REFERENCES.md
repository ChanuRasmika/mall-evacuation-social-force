# References

IEEE style. The numbering matches the citations in [THEORY.md](THEORY.md) and the notebook.

## Pedestrian dynamics model

1. D. Helbing and P. Molnár, "Social force model for pedestrian dynamics," *Phys. Rev. E*, vol. 51, no. 5, pp. 4282–4286, 1995, doi: [10.1103/PhysRevE.51.4282](https://doi.org/10.1103/PhysRevE.51.4282).
   *Used for:* the Social Force Model formulation, the desired walking-speed distribution (mean 1.34 m/s, s.d. 0.26 m/s) and the maximum speed $1.3\,v^0$.
2. D. Helbing, I. Farkas and T. Vicsek, "Simulating dynamical features of escape panic," *Nature*, vol. 407, pp. 487–490, 2000, doi: [10.1038/35035023](https://doi.org/10.1038/35035023).
   *Used for:* the body-compression and sliding-friction forces, and the values of $m$, $\tau$, $A$, $B$, $k$, $\kappa$ and $r_i$.

## Numerical methods

3. L. Verlet, "Computer 'experiments' on classical fluids. I. Thermodynamical properties of Lennard-Jones molecules," *Phys. Rev.*, vol. 159, no. 1, pp. 98–103, 1967, doi: [10.1103/PhysRev.159.98](https://doi.org/10.1103/PhysRev.159.98).
   *Used for:* Verlet time integration.
4. W. C. Swope, H. C. Andersen, P. H. Berens and K. R. Wilson, "A computer simulation method for the calculation of equilibrium constants for the formation of physical clusters of molecules: Application to small water clusters," *J. Chem. Phys.*, vol. 76, no. 1, pp. 637–649, 1982, doi: [10.1063/1.442716](https://doi.org/10.1063/1.442716).
   *Used for:* the velocity form of the Verlet algorithm.
5. M. P. Allen and D. J. Tildesley, *Computer Simulation of Liquids*, 2nd ed. Oxford, U.K.: Oxford Univ. Press, 2017.
   *Used for:* the cell-list neighbour search and interaction cut-offs.
6. E. W. Dijkstra, "A note on two problems in connexion with graphs," *Numer. Math.*, vol. 1, pp. 269–271, 1959, doi: [10.1007/BF01386390](https://doi.org/10.1007/BF01386390).
   *Used for:* the node-acceptance order of the distance-map computation (fast marching extends it).

## Validation data

7. A. Seyfried, O. Passon, B. Steffen, M. Boltes, T. Rupprecht and W. Klingsch, "New insights into pedestrian flow through bottlenecks," *Transp. Sci.*, vol. 43, no. 3, pp. 395–406, 2009, doi: [10.1287/trsc.1090.0263](https://doi.org/10.1287/trsc.1090.0263).
   *Used for:* measured flow through bottlenecks of different widths, for the plausibility check on exit flow.
8. T. Kretz, A. Grünebohm and M. Schreckenberg, "Experimental study of pedestrian flow through a bottleneck," *J. Stat. Mech.*, vol. 2006, no. 10, Art. no. P10014, 2006, doi: [10.1088/1742-5468/2006/10/P10014](https://doi.org/10.1088/1742-5468/2006/10/P10014).
   *Used for:* measured flow through bottlenecks, for the plausibility check on exit flow.

## Statistics and simulation methodology

9. A. M. Law, *Simulation Modeling and Analysis*, 5th ed. New York, NY, USA: McGraw-Hill, 2015.
   *Used for:* independent replications and t-based confidence intervals.

## Distance-map method

10. J. A. Sethian, "A fast marching level set method for monotonically advancing fronts," *Proc. Natl. Acad. Sci. USA*, vol. 93, no. 4, pp. 1591–1595, 1996, doi: [10.1073/pnas.93.4.1591](https://doi.org/10.1073/pnas.93.4.1591).
   *Used for:* the fast marching method that computes the walking-distance map and each person's route.
