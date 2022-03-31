"""This function provides specific helpers functions
to alleviate the complexity of the main code."""

def exponential_average(new_value, prev_exponential_avg, refresh_time_constant):
    """Compute the exponential average of an item. Compared to the classic moving average
    you only have to save the last exponential average.

    Parameters:
        new_value: The value to add for the update of the exponential average
        prev_exponential_avg: The previous value of the exponential average
        refresh_time_constant: The refresh time constant. It is a multiplicator factor to tune.
        It should be follow: refresh_time_constant = 2/(Period+1)

    Returns:
        new_exponential_avg : The updated exponential average
    """
    new_exponential_avg = (
        new_value - prev_exponential_avg
    ) * refresh_time_constant + prev_exponential_avg
    return new_exponential_avg


def compute_r_u_vector_updated(rating_vector, dict_id_nb_message, mark):
    """Compute the updated rating vector. Update it given the previous vector,
    the mark computed previously and the ids to which we affect the mark.
    // TO DO : Take into account in the mark the number of messages exchanged
    by the other users.

    Parameters:
        rating_vector: The current rating vector to update
        dict_id_nb_message: Dictonary with the mapped ids of the users
        who participated in a conversation with the user u.
        mark: The mark to attribute to the users who participated.

    Returns:
        rating_vector : The updated rating vector of the user u.
    """
    for user_id_temp in dict_id_nb_message:
        rating_vector[user_id_temp] = mark
    return rating_vector
