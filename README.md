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

# How room are managed?

## User - Start Awa

```mermaid
sequenceDiagram
    participant oth as other room users
    actor u as user
    participant m as matchmaker
    participant s as websocket server
    participant f as firebase
    u ->> u: GET room on disk
    alt has room
        u ->> s: connect to websocket server
        alt connection not accepted
            u ->> f: unsubscribe to room_id topic
            u ->> u: delete room
        end
    end
    alt room is not defined
        u ->> m: GET room
        m ->> m: process [user ask for a room]
        m ->> u: room_id, room_address, room_port
        u ->> f: subscribe to room_id topic
    end
    u ->> s: connect to websocket server
    loop while room alive
        oth ->> s: send message
        alt is app in foreground
            s ->> u: broadcast message
        else
            f ->> u: notify user
        end
    end
```

### GET room on disk

```mermaid
sequenceDiagram
    participant u as user
    participant d as disk
    participant m as matchmaker
    participant w as websocket server
    u -> d: GET box
    note over u,d: <List<String>>
    alt box has room
        u ->> u: Load room messages
    else
        u -> m: GET room
        
    end
    u -> w: connect to room
```

## User - Ask for a room

```mermaid
sequenceDiagram
    actor user
    participant MM as matchmaker
    participant FM as fleet manager
    user ->> MM: GET room (IP, port)
    alt is current room full
        MM ->> FM: create new room
        FM ->> FM: process [update active ports]
        alt is space for new room
            FM ->> MM: new room port
            MM ->> user: new room (IP, port)
        else
            FM ->> MM: error
            MM ->> user: error
        end
    else
      MM ->> user: current room (IP, port)
    end
```

### Matchmaker memory logic

> `current room` is a variable holding the endpoint for the current room returned by the **matchmaker**. Updating the `current room` is updating its value by a new value.

> This is architecture doesn't handle recommendation from user. It queues user in room by order of arrival. **It will change in a future update.**

```mermaid
graph LR
    room --> C{is full?}
    C -.-> |yes|C_1{has space for new room?}
    C -.-> |no|E_0[return current room]
    C_1 -.-> |yes|E_1[create new room]
    E_1 -.-> E_3[update current room]
    C_1 -.-> |no|E_2[return error]
    E_3 -.-> E_0
```

```
stateDiagram
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
    an: add user to room
    v --> an

    c: new room
    ac: add new room with user
    c --> ac

    an --> [*]
    ac --> [*]
```

## Fleet manager - Update active ports

```mermaid
sequenceDiagram
    participant FM as fleet manager
    participant D as docker API
    loop container
        D ->> FM: container image
        alt is from server image
            D ->> FM: container status
            alt is container running
                D ->> FM: container open ports
                alt has open ports
                    FM ->> FM: lock open ports
                end
            end
        end
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

# Codebase

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