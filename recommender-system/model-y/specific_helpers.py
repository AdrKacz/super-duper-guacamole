"""This function provides specific helpers functions
to alleviate the complexity of the main code."""
import json
import numpy as np


def get_y_matrix_reconstructed(
    items, max_mapped: int, k_val: int, user_id_field_name: str
) -> np.ndarray:
    """Build the Y matrix of the Master Model part, from items got through
    a scan of the DynamoDB table that saves the Y rows.

    Parameters:
        items: The items that contains the rows of the matrix
        max_mapped: The maximum number of rows, == Y.shape[0]
        k_val: Hyperparameter of the model. Set by the developper
        user_id_field_name: str, key_word to access the values in the items' elements

    Returns:
        y_matrix : The Y matrix
    """
    y_matrix = np.zeros((max_mapped + 1, k_val))  # .T at the end of the for loop
    for item in items:
        user_temp_id = int(item[user_id_field_name])
        vector = np.array(json.loads(item["vector"]))
        y_matrix[user_temp_id, :] = vector
    y_matrix = y_matrix.T
    return y_matrix


def get_gradient_y_matrix_reconstructed(items, n_users: int, k_val: int) -> np.ndarray:
    """Build the Gradient matrix of Y, the Master Model part, from items got through
    a scan of the DynamoDB table that saves the partial gradient computed by the users.

    Parameters:
        items: The items that contains the rows of the gradient matrix of Y
        n_users: The number of users
        K_VAL: Hyperparameter of the model. Set by the developper

    Returns:
        gradient_y_matrix : The Gradient matrix of Y
    """
    gradient_y_matrix = np.zeros((n_users, k_val))
    for item in items:
        temp_matrix = np.array(json.loads(item["gradient_from_user"]))
        n_users_t, k_val_t = temp_matrix.shape
        print("n_users_t, k_val_t, n_users, K_VAL", n_users_t, k_val_t, n_users, k_val)
        if n_users_t < n_users:
            temp_matrix_right_shape = np.zeros((n_users, k_val))
            temp_matrix_right_shape[:n_users_t, :] = temp_matrix
        else:
            temp_matrix_right_shape = temp_matrix
        gradient_y_matrix = gradient_y_matrix + temp_matrix_right_shape
    return gradient_y_matrix


def compute_stochastic_grad_descent(
    y_mat_transposed: np.ndarray,
    gradient_y_matrix: np.ndarray,
    lambda_regularization: float,
    beta_1: float,
    beta_2: float,
    gamma: float,
    epsilon: float,
    num_iteration_adam: int,
) -> np.ndarray:
    """Build the Gradient matrix of Y, the Master Model part, from items got through
    a scan of the DynamoDB table that saves the partial gradient computed by the users.

    Parameters:
        y_mat_transposed: The items that contains the rows of the gradient matrix of Y
        gradient_y_matrix: The number of users
        lambda_regularization: Hyperparameter of the model. Set by the developper
        beta_1: Hyperparameter to tune for an optimal training. Set to 0.4 in the source paper
        beta_2: Hyperparameter to tune for an optimal training. Set to 0.99 in the source paper
        gamma: Hyperparameter to tune for an optimal training. Set to 0.2 in the source paper
        epsilon: Float to avoid a division by zero
        num_iteration_adam: Number of iteration of the gradient descent with the
        Adam optimizer function. Set to 20 in the source paper

    Returns:
        y_mat_transposed_temp : The update of the Y matrix, after the gradient descent
    """

    y_mat_transposed_temp = y_mat_transposed.copy()
    gradient_y_matrix_temp = gradient_y_matrix.copy()

    gradient_y_matrix_temp = (
        -2 * gradient_y_matrix_temp + 2 * lambda_regularization * y_mat_transposed
    )
    m_exp, v_exp = 0.0, 0.0
    for _ in range(num_iteration_adam):
        m_exp = beta_1 * m_exp + (1 - beta_1) * gradient_y_matrix_temp
        v_exp = beta_2 * v_exp + (1 - beta_2) * gradient_y_matrix_temp**2
        m_hat = m_exp / (1 - beta_1)
        v_hat = v_exp / (1 - beta_2)
        y_mat_transposed_temp = y_mat_transposed_temp - gamma * m_hat / (
            np.sqrt(v_hat) + epsilon
        )  # (n_users, K_VAL)

    return y_mat_transposed_temp
