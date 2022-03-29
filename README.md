# super-duper-guacamole

> [Awa - Notion](https://purring-shark-0e9.notion.site/Awa-048af14525474c29828c867d0ba553a6)

> [Awa - University Slides](https://docs.google.com/presentation/d/1QThoIvIGAeG6SlSOOstbqLRikrF3WBQCePyzSukguPY/edit?usp=sharing) *(written in French for our university)*

# Cloud Architecture

> We chose a **centralised architecture** to use state-of-the-art libraries in Machine Learning with **Python**. However, we keep the code as close as possible to a **decentralised** version, so we will be able to switch later on. The goal is to verify the model works.

## Current Architecture - Centralised

![awa-cloud](./diagram-cloud-architecture/awa_cloud.png)

> This architecture is *centralised*

# App states

```mermaid
stateDiagram-v2
    HomePage --> MainPage: join
    MainPage --> MainPage: chat
    MainPage --> HomePage: quit
```

# Sequence Diagram
In a **centralised architecture**, the code that infers the correct set of users belongs to the **cloud**. Thus, it uses whatever languages.

## Ideal Architecture - Distributed and Decentralised

> `Federated` architecture will simply remove the **_client models_ database**

In a **distributed architecture**, the code that infers the correct set of users belongs to the **user app**. Thus, it uses the client technologies.

# How an user find a room?

```mermaid
sequenceDiagram
    participant r as recommender system
    actor u as user
    participant m as matchmaker
    participant f as fleet manager
    u ->> r: who are the best users for me?
    r ->> u: Set of users
    u ->> m: I want a room with these users
    m ->> m: find best existing room
    alt room is not good enough
      m -->> f : create new room
      f -->> m : room endpoint
      m -->> m : save room endpoint
    end
    m ->> u: room endpoint
    m ->> u : endpoint
```

# Rooms lifecycle

## What happens when you change room?

```mermaid
sequenceDiagram
    actor oth as other users
    participant d as disk
    actor u as user
    participant m as matchmaker
    participant s as websocket server
    participant f as firebase
    alt room
        u ->> f: UNSUBSCRIBE from room
    end
    u ->> m: GET room
    u ->> d: PUT room BOX - room
    u ->> f: SUBSCRIBE to room
    u -> s: CONNECT to room
    loop room is alive
        par
            oth ->> s: SEND messages
        and
            u ->> s: SEND messages
        end
        par 
            s ->> u: SEND messages
            alt app in foreground
                u ->> u: PROCESS incomming messages
            end
        and
            s ->> f: SEND messages
            f ->> u: SEND push notifications
            alt app in background
                u ->> u: PROCESS push notifications
            end
        end
    end
```

# Disk management

## On open

```mermaid
sequenceDiagram
    participant u as user
    participant d as disk
    participant m as matchmaker
    participant w as websocket server
    u -> d: CONNECT room BOX
    u -> d: CONNECT messages LAZYBOX
    alt room BOX has id
        u ->> d: GET messages LAZYBOX - end
        loop 0..end
            u ->> d: GET messages LAZYBOX - i
        end
    else
        u ->> m: GET room
        u ->> d: PUT room BOX - room
        
    end
    u -> w: CONNECT room
```

## On send message

```mermaid
sequenceDiagram
    participant u as user
    participant d as disk
    participant m as matchmaker
    participant w as websocket server
    u -> w: CONNECT room
    loop until deconnexion
        par
            u ->> w: SEND message
        and
            w ->> u: RECEIVE message
            u ->> u: update local messages
            u ->> d: ADD messages LAZYBOX - message
        end
    end
```

# How to get a new room?

```mermaid
sequenceDiagram
    actor u as user
    participant m as matchmaker
    participant f as fleet manager
    u ->> m: GET room
    m ->> m: GET room for user in memory
    alt matchmaker has no room
        m ->> f: GET new room
        f ->> f: create new room
        alt fleet manager has room
            f ->> m: RETURN room
        else
            f ->> m: RETURN error
            m ->> u: RETURN error
        end
    end
    m ->> m: update room in memory
    m ->> u: RETURN room
```

## How does the matchmaker manage rooms?

> The following executes on `GET room` from `user`.

```mermaid
stateDiagram
%%{config: { "themeCSS": ".label foreignObject { overflow: visible; }" }%%
    direction TB
    state i1 <<choice>>
    [*] --> i1
    i1 --> n: has next room
    i1 --> c: no more room
    n: next room
    v: valid room

    state i2 <<choice>>
    n --> i2
    i2 --> v: room has space
    i2 --> n: room is full
    an: add user to valid room
    v --> an

    c: new room
    ac: add new room with user
    c --> ac

    an --> [*]
    ac --> [*]
```

## How does the fleet manager manage rooms?

> The following executes on `GET new room` from `matchmaker`.

```mermaid
sequenceDiagram
    participant f as fleet manager
    participant dd as docker daemon
    f ->> dd: GET containers
    loop containers
        f ->> dd: GET container image
        alt is websocket server
            f ->> dd: GET container status
            alt is running
                f ->> dd: GET container open ports
                alt has open ports
                    f ->> f: update list of available ports
                end
            end
        end
    end

    f ->> f: GET available port
    alt is available port
        f ->> dd: RUN websocket server container on available port
    end
```

# Screenshots

<p float="left" align="middle">
    <img src="./screenshots/screenshot_0745.PNG" width="32%">
    <img src="./screenshots/screenshot_0746.PNG" width="32%">
    <img src="./screenshots/screenshot_0747.PNG" width="32%">
    <img src="./screenshots/screenshot_0748.PNG" width="32%">
    <img src="./screenshots/screenshot_0749.PNG" width="32%">
    <img src="./screenshots/screenshot_0750.PNG" width="32%">
    <img src="./screenshots/screenshot_0751.PNG" width="32%">
    <img src="./screenshots/screenshot_0752.PNG" width="32%">
    <img src="./screenshots/screenshot_0753.PNG" width="32%">
</p>

---

### Note on Godot

Using **Godot** for a simple chat may *not be the best idea*. Indeed, **Godot** is really useful when it comes to *real-time 2D* and *real-time 3D*. Using a standard technology (*ReactNative*) would be more appropriate here.

### Note on Flutter

**Flutter** is quicker to setup than **React Native** *(I mean, literally quicker, it doesn't burn my laptop)*. I've used (Flutter Chat UI)[https://pub.dev/packages/flutter_chat_ui] to get a first chat without coding. *The same framework was available with **React Native***

<details><summary>Codebase</summary>
<p>

```sh
# macOS: brew install cloc
>> cloc --exclude-ext=md .
    6070 text files.
    3094 unique files.                                          
    8876 files ignored.

github.com/AlDanial/cloc v 1.92  T=14.74 s (209.9 files/s, 98342.9 lines/s)
-----------------------------------------------------------------------------------
Language                         files          blank        comment           code
-----------------------------------------------------------------------------------
Assembly                             1              0              0         759768
Python                            1314          56070          65594         245916
C                                   11          13263          65387         116009
JSON                               807              5              0          50858
Objective-C                        137           3438           3601          17625
XML                                445           1190            703          15063
Cython                              47           2267           1020           8091
C/C++ Header                       235           2798           9312           5440
Markdown                             1            321              0           1517
Dart                                 5            104             77            687
C++                                  5             81             29            317
HTML                                 2             12             28            265
Properties                          17              0             13            251
Bourne Shell                         5             30             33            227
CMake                                4             34             30            167
Godot Scene                          1             23              0            133
GDScript                             2             37              5            129
Bourne Again Shell                   1             19             20            121
JavaScript                           5             16             10            106
PowerShell                           1             48             89            104
Gradle                               3             21              1            103
Java                                11             13             43            103
Fish Shell                           2             26             26             76
Windows Resource File                1             23             29             69
reStructuredText                     3             15              0             69
DOS Batch                            1             24              2             64
YAML                                 4             22             84             58
Dockerfile                           4             18             11             37
C Shell                              2             18             10             22
Godot Resource                       2              5              0             17
Swift                                1              1              0             12
D                                   11              0              0             11
Ruby                                 1              1              6             11
Kotlin                               1              2              0              4
SQL                                  1              0              0              2
-----------------------------------------------------------------------------------
SUM:                              3094          79945         146163        1223452
```

</p>
</details>

