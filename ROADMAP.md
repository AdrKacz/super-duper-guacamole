# Roadmap

```mermaid
gantt
    dateFormat YYYY-MM-DD
    axisFormat %a %e %b %Y
    excludes weekends, 2022-03-14, 2022-03-15

    section SDE
        UDP Server Workflow : done, s11, 2022-03-10, 1d 
        Fleet Manager with Queue : done, s12, after s11, 1d
        Matchmaking at start : active, s13, after s12, 1d 
        Testflight and GPC Beta ready : s14, after s13, 1d

    section MLE
        Learn AWS: s20, 2022-03-10, 2d 
        Setup Endpoint and Lambda trigger : s21, 2022-03-10, 1d
        Cloud based federated learning : s22, after s21, 2d 
        Beta registration form: s231, after s22, 1d
        ECL communication : s232, after s22, 1d
        Media (Reddit, Twitter) communication : s233, after s22, 1d
```

> Une tâche est considéré comme terminée une fois qu'elle est *merged* dans la *main branch* avec sa documentation.

> La soutenance aura lieu de 24 mars, la *roadmap* se termine le 18 mars. Cela nous laisse le 23 mars pour une gérer d'éventuels *bug* et corriger la documentation.