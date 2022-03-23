# diagram.py
from diagrams import Cluster, Diagram, Edge
from diagrams.generic.device import Mobile
from diagrams.onprem.container import Docker
from diagrams.aws.compute import Lambda, Lightsail
from diagrams.aws.network import Endpoint
from diagrams.firebase.grow import Messaging

graph_attr = {
    "fontsize": "45",
}

edge_attr = {
    "color": "black",
}

with Diagram(
    "Awa Cloud",
    show=False,
    graph_attr=graph_attr,
    curvestyle="curved",
    edge_attr=edge_attr,
    direction="TB",
    ):
      
    with Cluster("Lighsail"): 
        endpoint_8080 = Endpoint("8080 - Matchmaker")
        endpoint_8000 = Endpoint("8000 - Fleet Manager")
        with Cluster("Rooms"):
            endpoints = []
            dockers = []
            for i in range(3):
                e = Endpoint(str(9000 + i))
                d = Docker()
                e - d
                endpoints.append(e)
                dockers.append(d)   
        endpoint_8080 >> Edge(style="bold") >> endpoint_8000

    
    messaging = Messaging()
    notification = Lambda("Notification Handler")
    dockers << Edge(style="dotted") << notification
    notification >> Edge(style="dotted") >> messaging

    mobile = Mobile()
    messaging >> Edge(style="dotted") >> mobile
    mobile << Edge(style="dotted") << messaging
    mobile >> Edge(
        style="bold",
        labeldistance= "5",
        taillabel="2",
        fontsize="24",
        color="red",
        labelfontcolor="red") >> endpoint_8080
    mobile - Edge(
        taillabel="3",
        labeldistance= "4",
        fontsize="24",
        color="blue",
        labelfontcolor="blue") - endpoints
