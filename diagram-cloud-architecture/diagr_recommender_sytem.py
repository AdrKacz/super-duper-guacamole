"""This function generates png images representing the current architecture
of the recommender system."""
from diagrams import Cluster, Diagram, Edge
from diagrams.generic.device import Mobile
from diagrams.aws.compute import LambdaFunction
from diagrams.aws.mobile import APIGatewayEndpoint
from diagrams.aws.compute import EC2ContainerRegistry
from diagrams.aws.database import DynamodbTable

graph_attr = {
    "fontsize": "45",
}

edge_attr = {
    "color": "black",
}

with Diagram(
    "Awa Recommender System",
    show=False,
    graph_attr=graph_attr,
    curvestyle="ortho",
    edge_attr=edge_attr,
    direction="TB",
):
    mobile = Mobile()

    with Cluster("API Gateway - HTTP Endpoints"):
        api_gateway_get_recommendation = APIGatewayEndpoint()
        api_gateway_mapping = APIGatewayEndpoint()
        api_gateway_marks = APIGatewayEndpoint()
        apis = [api_gateway_get_recommendation, api_gateway_mapping, api_gateway_marks]

    with Cluster("Lambdas"):
        lambda_y = LambdaFunction("Master Model")
        lambda_mapping = LambdaFunction("Mapping")
        lambda_R = LambdaFunction("Ratings Update")
        lambda_x = LambdaFunction("User Model - X")
        lambdas = [lambda_y, lambda_mapping, lambda_R, lambda_x]
        for i, api in enumerate(apis):
            api >> lambdas[i]
        lambda_y >> lambda_x

    ecr_lambdas = EC2ContainerRegistry("ECR Lambdas")
    ecr_lambdas >> Edge(fontsize="24", color="black", labelfontcolor="red") >> lambdas

    with Cluster("DynamoDB"):
        with Cluster("Mapping Tables"):
            table_mapping = DynamodbTable("Mapping")
            table_demapping = DynamodbTable("De-Mapping")
            mapping_tables = [table_mapping, table_demapping]

        table_R_ratings = DynamodbTable("Ratings Matrix")
        table_x_user_model = DynamodbTable("User Model Weights")
        with Cluster("Master Model Tables"):
            table_y_master_model = DynamodbTable("Weights")
            table_gradient_y = DynamodbTable("Gradient Aggregation")
            master_model_y_tables = [table_y_master_model, table_gradient_y]

        lambda_y >> master_model_y_tables
        lambda_y >> Edge(style="dotted") >> mapping_tables

        lambda_mapping >> mapping_tables

        lambda_R >> Edge(style="dotted") >> table_mapping
        lambda_R >> table_R_ratings

        lambda_x >> table_x_user_model

    mobile >> Edge() >> apis
