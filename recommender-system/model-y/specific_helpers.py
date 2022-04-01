import json
import numpy as np


def get_y_matrix_reconstructed(items, max_mapped, K_VAL, USER_ID):
    y_matrix = np.zeros((max_mapped + 1, K_VAL))  # .T at the end of the for loop
    for item in items:
        user_temp_id = int(item[USER_ID])
        vector = np.array(json.loads(item["vector"]))
        y_matrix[user_temp_id, :] = vector
    y_matrix = y_matrix.T
    return y_matrix


def get_gradient_y_matrix_reconstructed(items, max_mapped, n_users, K_VAL, USER_ID):
    gradient_y_matrix = np.zeros((n_users, K_VAL))
    for item in items:
        temp_matrix = np.array(json.loads(item["gradient_from_user"]))
        n_users_t, k_val_t = temp_matrix.shape
        print("n_users_t, k_val_t, n_users, K_VAL", n_users_t, k_val_t, n_users, K_VAL)
        if n_users_t < n_users:
            temp_matrix_right_shape = np.zeros((n_users, K_VAL))
            temp_matrix_right_shape[:n_users_t, :] = temp_matrix
        else:
            temp_matrix_right_shape = temp_matrix
        gradient_y_matrix = gradient_y_matrix + temp_matrix_right_shape
    return gradient_y_matrix


def compute_stochastic_grad_descent(
    y_mat_transposed,
    gradient_y_matrix,
    lambda_regularization,
    beta_1,
    beta_2,
    gamma,
    epsilon,
    num_iteration_adam,
):
    y_mat_transposed_temp = y_mat_transposed.copy()
    gradient_y_matrix_temp = gradient_y_matrix.copy()

    gradient_y_matrix_temp = (
        -2 * gradient_y_matrix_temp + 2 * lambda_regularization * y_mat_transposed
    )
    m_exp, v_exp = 0.0, 0.0
    for i in range(num_iteration_adam):
        m_exp = beta_1 * m_exp + (1 - beta_1) * gradient_y_matrix_temp
        v_exp = beta_2 * v_exp + (1 - beta_2) * gradient_y_matrix_temp**2
        m_hat = m_exp / (1 - beta_1)
        v_hat = v_exp / (1 - beta_2)
        y_mat_transposed_temp = y_mat_transposed_temp - gamma * m_hat / (
            np.sqrt(v_hat) + epsilon
        )  # (n_users, K_VAL)
    return y_mat_transposed_temp
