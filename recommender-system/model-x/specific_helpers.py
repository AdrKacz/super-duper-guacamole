"""This function provides specific helpers functions
to alleviate the complexity of the main code."""
import numpy as np


def compute_optimal_x_u(y_matrix, c_u, p_u_trans, k_val, lambda_regulation):
    """Compute the update of the x_u vector

    Parameters:
        y_matrix: The Y matrix, Master part of the model
        c_u: The confidence parameter. Account for the uncertainty of the ratings r_u
        p_u_trans: The transposed vector of p_u
        k_val: The number of parameters. Set by the developer
        lambda_regulation: Regularization parameter, set by the developer

    Returns:
        optimal_x_u : The optimal solution to the optimization problem.
    """
    c_u_diag = np.diag(c_u.squeeze().tolist())
    optimal_x_u = np.dot(
        np.linalg.inv(
            y_matrix @ c_u_diag @ y_matrix.T + lambda_regulation * np.identity(k_val)
        ),
        y_matrix @ c_u_diag @ p_u_trans,
    )
    return optimal_x_u


def compute_user_model_x(y_matrix, x_u, r_u, k_val, alpha, lambda_regulation):
    """Compute the update of the x_u vector

    Parameters:
        y_matrix: The Y matrix, Master part of the model
        x_u: The user_id (int) row of the User-Model matrix X
        r_u: The ratings vector of the user
        k_val: The number of parameters. Set by the developer
        alpha: The parameter to set to account for the uncertainty of the ratings r_u
        lambda_regulation: Regularization parameter, set by the developer

    Returns:
        optimal_x_u : The optimal solution to the optimization problem for X.
        inference_x :
    """
    # In the original paper federated learning is based on : p_ui = r_ui != 0.0==> p_ui in [0,1]
    # Here p_u = r_u, to keep the gradual information of the marks
    p_u = r_u  # (1,n_users)
    # c_ui = 1 + ALPHA*r_ui
    c_u = 1 + alpha * r_u  # (1,n_users)
    p_u_trans = p_u.T

    # Optimal x_u computation
    optimal_x_u = compute_optimal_x_u(
        y_matrix, c_u, p_u_trans, k_val, lambda_regulation
    )

    # Inference computation
    inference_x = np.dot(optimal_x_u.T, y_matrix)  # (1,n_users)
    print(inference_x)

    # Gradient computation
    # Formally: y_i = y_i - gamma*dJ/dy_i
    f_u = (c_u.T * (p_u_trans - y_matrix.T @ x_u)) @ x_u.T  # (n_users,k_val)

    return optimal_x_u, inference_x, f_u
