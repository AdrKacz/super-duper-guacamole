# super-duper-guacamole

# Cloud Architecture

> We chose a **centralised architecture** to use state-of-the-art libraries in Machine Learning with **Python**. However, we keep the code as close as possible to a **decentralised** version, so we will be able to switch later on. The goal is to verify the model works.

## Current Architecture - Centralised

![awa-services](./diagram-cloud-architecture/awa_service.png)

> This architecture is *centralised*

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
    alt has no room
        m ->> f: GET new room
        f ->> f: create new room
        alt has room
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
    <img src="./screenshots/screenshot_0693.PNG" width="32%">
    <img src="./screenshots/screenshot_0694.PNG" width="32%">
    <img src="./screenshots/screenshot_0695.PNG" width="32%">
    <img src="./screenshots/screenshot_0696.PNG" width="32%">
    <img src="./screenshots/screenshot_0697.PNG" width="32%">
    <img src="./screenshots/screenshot_0703.PNG" width="32%">
    <img src="./screenshots/screenshot_0704.PNG" width="32%">
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
     962 text files.
     603 unique files.                                          
     671 files ignored.

github.com/AlDanial/cloc v 1.92  T=0.73 s (827.3 files/s, 80211.0 lines/s)
-----------------------------------------------------------------------------------
Language                         files          blank        comment           code
-----------------------------------------------------------------------------------
Objective-C                        136           3437           3601          17614
XML                                182            277             46           8544
C/C++ Header                       230           2767           9304           5339
C                                    6            439            344           2031
Markdown                             1            315              0           1494
JSON                                12              4              0            760
Dart                                 5             53             63            324
C++                                  5             81             29            317
Bourne Shell                         2             24             25            178
CMake                                4             34             30            167
Bourne Again Shell                   1             19             20            121
Gradle                               3             21              1            103
HTML                                 1              9             15             80
Windows Resource File                1             23             29             69
DOS Batch                            1             24              2             64
YAML                                 2             19             81             31
Java                                 1              3              5             26
Properties                           5              0              2             18
Swift                                1              1              0             12
Ruby                                 1              1              6             11
Kotlin                               1              2              0              4
D                                    2              0              0              2
-----------------------------------------------------------------------------------
SUM:                               603           7553          13603          37309
-----------------------------------------------------------------------------------
```

</p>
</details>