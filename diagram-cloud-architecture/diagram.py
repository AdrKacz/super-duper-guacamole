# diagram.py
from diagrams import Diagram, Edge
from diagrams.generic.device import Mobile
from diagrams.onprem.container import Docker
from diagrams.aws.compute import Lambda, Lightsail
from diagrams.aws.database import Dynamodb
from diagrams.aws.network import APIGateway, Endpoint

with Diagram("Awa service", show=False):
    model_provider_endpoint = APIGateway("Model provider endpoint")
    dockers = Docker("UDP Server")
    match_maker_endpoint = APIGateway("Matchmaker endpoint")
    udp_server_port = Endpoint("UDP Server Port")

    model_provider_endpoint >> Lambda("Model provider") >> [
        Dynamodb("Global Model"),
        Dynamodb("Client Models"),
    ]

    (match_maker_endpoint >> Lambda("Matchmaker") >> Lightsail("UDP Server Fleet")) - dockers
    udp_server_port - dockers
    
    client = Mobile("Client")
    client >> match_maker_endpoint
    client - udp_server_port
    client >> Edge() << model_provider_endpoint