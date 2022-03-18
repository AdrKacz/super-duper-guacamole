# super-duper-guacamole

# Cloud Architecture

## Current Architecture

![awa-services](./diagram-cloud-architecture/awa_service.png)

> This architecture is *centralised*

## Ideal Architecture

> `Federated` architecture will simply remove the **_client models_ database**

# App states

```mermaid
stateDiagram-v2
    HomePage --> MainPage: join
    MainPage --> MainPage: chat
    MainPage --> HomePage: quit
```

# Sequence Diagram

## Distributed

```mermaid
sequenceDiagram
      participant Client as Client
      participant Model as Model provider
      participant Match as Matchmaker
      participant Server as Server
      Client ->> Model: GET Model Y
      Model ->> Client: Model Y
      Client ->> Client: Inference
      par Actualise model
      Client ->> Model: POST Inference Gradient
      Model ->> Model: Actualise Model Y
      and Get UDP server
      Client ->> Match: POST Set of users
      Match ->> Match: Match users
      Match ->> Server: GET UDP Server
      Server ->> Match: PORT UDP Server
      Match ->> Client: PORT UDP Server
      end
```

In a **distributed architecture**, the code that infers the correct set of users belongs to the **client app**. Thus, it uses the client technologies: Godot and GDScript.

## Centralised

```mermaid
sequenceDiagram
      participant Client as Client
      participant Model as Model provider
      participant Match as Matchmaker
      participant Server as Server
      Client ->> Model: GET Set of users
      par Client model
      Model ->> Model: Get Model X of Client
      and Global model
      Model ->> Model: Get Model Y
      end
      Model ->> Model: Inference
      Model ->> Model: Actualise Model Y
      Model ->> Client: Set of users
      Client ->> Match: POST Set of users
      Match ->> Match: Match users
      Match ->> Server: GET UDP Server
      Server ->> Match: PORT UDP Server
      Match ->> Client: PORT UDP Server
```

In a **centralised architecture**, the code that infers the correct set of users belongs to the **cloud**. Thus, it uses whatever languages.

> We will first choose the **centralised architecture** to use state-of-the-art libraries in Machine Learning with **Python**. However, we'll keep the code as close as possible to a **decentralised** version, so we will be able to switch later on. The objective is to verify as quickly as possible that the model works.

# How an user find a room?

```mermaid
sequenceDiagram
    participant RS as Recommender system
    actor User
    participant MM as Matchmaker
    participant FM as Fleet manager
    User ->> RS: who are the best users for me?
    RS ->> User: Set of users
    User ->> MM: I want a room with these users
    MM ->> MM: find best rooms
    MM -->> FM : create new rooms
    FM -->> MM : endpoints
    MM ->> User : endpoint
```

```mermaid
graph LR
    room --> C{is full?}
    C -.-> |yes|C_1{has space for new room?}
    C -.-> |no|E_0[return current room]
    C_1 -.-> |yes|E_1[update current room]
    C_1 -.-> |no|E_2[return error]
    E_1 -.-> E_0
```

## Questions

> Will user who likes the same worlds will like eachothers? Will it work with few worlds?

# How room are managed?

## User start Awa

```mermaid
sequenceDiagram
    participant oth as other room users
    participant u as user
    participant m as matchmaker
    participant s as websocket server
    participant f as firebase
    link m: process @ https://github.com/AdrKacz/super-duper-guacamole#user-ask-for-a-room
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
        m ->> m: process
        m ->> u: room_id, room_address, room_port
    end
    u ->> s: connect to websocket server
    u ->> f: subscribe to room_id topic
    loop while room alive
        oth ->> s: send message
        alt is user app in foreground
            s ->> u: broadcast message
        else
            f ->> u: notify user
        end
    end
```

## User ask for a room

```mermaid
sequenceDiagram
    actor User
    participant MM as Matchmaker
    participant FM as Fleet Manager
    User ->> MM: GET room (IP, port)
    alt is current room full
        MM ->> FM: create new room
        FM ->> FM: update active ports
        alt is space for new room
            FM ->> MM: new room port
            MM ->> User: new room (IP, port)
        else
            FM ->> MM: error
            MM ->> User: error
        end
    else
      MM ->> User: current room (IP, port)
    end
```

## Fleet manager update active ports

```mermaid
sequenceDiagram
    participant FM as Fleet Manager
    participant D as Docker API
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
     266 text files.
     120 unique files.                                          
     400 files ignored.

github.com/AlDanial/cloc v 1.92  T=0.15 s (781.9 files/s, 57922.8 lines/s)
-----------------------------------------------------------------------------------
Language                         files          blank        comment           code
-----------------------------------------------------------------------------------
XML                                 39              7             45           3089
C/C++ Header                        26            348           1937            773
JSON                                11              1              0            603
C++                                  5             81             29            317
CMake                                4             34             30            167
Bourne Shell                         3             24             26            155
Dart                                 4             34             23            152
Bourne Again Shell                   1             19             20            121
YAML                                 4             26             82            109
Gradle                               3             19              3             88
HTML                                 1              9             15             80
Windows Resource File                1             23             29             69
DOS Batch                            1             24              2             64
JavaScript                           4             10              5             61
Markdown                             1              6              0             26
Objective-C                          3              6              4             21
Java                                 1              3              5             16
Swift                                1              1              0             12
Ruby                                 1              1              6             11
Properties                           3              0              1             10
Kotlin                               1              2              0              4
D                                    2              0              0              2
-----------------------------------------------------------------------------------
SUM:                               120            678           2262           5950
-----------------------------------------------------------------------------------
```