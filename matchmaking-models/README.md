**Version 0.0.0**

# Model to assign people to conversation groups

## Introduction
One of the main ideas of the project is to develop a software solution to assign people **apparently randomly** to conversation groups. However, we aim to create groups that have a positive dynamic, hence automatic learning answering to "how to assign people" is required. In a distributed architecture, we don't have access to people's information globally, so we have to do everything 'locally'.


# Local information available
Let `m` be the number of users/IDs. \
Let `m_conv` be the number of users/IDs in a conversation. (Parameter fixed by the developer.)
The IDs are public. \
The 'conversational graph' (who talked to who) is not.\
Then, locally each user has access to :
- Its own ID
- The knowledge that he has talked with some users/IDs.
- The messages that were exchanged in the different conversations he was involved in.

Then, for a conversation composed of `m_conv` members: All of those members know they have talked together. They have access to the knowledge they have talked with these `m_conv-1` IDs, and the messages exchanged.


# Create a new conversation
Let's first introduce the notion of **Relationship representation**.

## Private Relationship representation
With the local information available (further detailed later), we compute scores/weights, of `n` dim, **in the vision of each ID/user**. This representation is **PRIVATE**. (Only obtainable by the corresponding user). \
If the vector **e<sub>i,j</sub>** is the vectorized representation of the score of `i` in the vision of a `j`, the whole representation of the relationships can be expressed as a **sparse** matrix **M = (M<sub>i, j</sub>) <sub> (i,j)∈[0,m]²</sub>** - sparse because by convention, e<sub>i,j</sub> = `None` if user<sub>i</sub> doesn't know user<sub>j</sub>. \
Note: The matrix M is a way to represent this architecture, but since everything is done locally, it is not possible to compute wholly this Matrix.

If we consider euclidian distances between the e<sub>i,j</sub>, M is not symetric. Given the method to compute the e<sub>i,j</sub>, e<sub>i,j</sub> != e<sub>j,i</sub> is probable, since their interactions are not symetric (they don't use the exact same words, same frequency or anwers,..). \
This raise the point that (e<sub>i,j</sub>)<sub> i∈[0,m]</sub> is a vision for user<sub>j</sub> of the the other users. This vision is -or at least can be- **USER DEPENDENT**. 



## From Relationship Reprensentation (RR) to recommendations
Hence, to create a new conversation : For conversations of max `m_conv` individuals, if :
- user<sub>j1</sub> knows user<sub>j</sub> for j∈[1,m_conv]
- user<sub>i1</sub> is the closest individual to user<sub>j1</sub> (given scores/weights (e<sub>i,j1</sub>), i∈[1,m_conv])
- user<sub>i1</sub> knows user<sub>i</sub> for i∈[1,2m_conv] because he is involved in an other conversation.\

--> **user<sub>i1</sub> recommand APPROPRIATE individuals to user<sub>j1</sub> (close to user<sub>j1</sub> in the RR of user<sub>i1</sub>**, whom would be unkown for user<sub>j1</sub> : He meets new people, with a kind of 'recommendation system'.

To clarify : user<sub>i1</sub> only provides a user<sub>i</sub> ID, i∈[m+1,2m], and not his distance to  user<sub>j1</sub> in the user<sub>i1</sub>  representation ((e<sub>i,i1</sub>), i∈[1,m_conv]) . **The RR is private, and is never transmitted in whole**.

To recap :
- Each user<sub>i</sub> in the ((e<sub>i,j1</sub>), i∈[1,m_conv]) RR will recommend him somebody. 
- Sometimes it can be the same individual.
- We will introduce weighting terms that depends of user<sub>j1</sub> proximity to the 'recommender' user<sub>i</sub>, i∈[1,m]. (The closest the 'recommender' is, the more we should listen to him, he is a 'close friend').


# Main points still to determine :
## Weight the recommendations
2 options are possible :
- Distance (continuous) weighting : Compute (d(e<sub>i,j</sub>, e<sub>j,j</sub>)), i∈[1,m] , where d is an distance to define. Then the weithing term is a softmax of (d(e<sub>i,j</sub>, e<sub>j,j</sub>)), i∈[1,m].
- Discrete weighting: Giving the rank of the e<sub>i</sub> in the 'Proximity ranking', we attribute fixed weights. Could be appropriate if we don't have access to a distance to compute. In the beginning we could use logic gates on the weights computed.


## n-representation Features for clustering system

- Frequency of answer to somebody (to implement)
- Content of the messages --> Sentiment analysis: Pay attention to the irony/insults that can skew the results
- Topics identified

### Sentiment Analysis :
Word embeddings :
The most popular word embedding algorithms are :
- <cite>[Word2Vec][3]</cite> (Google)
- <cite>[GloVe][4]</cite> (Stanford)
- <cite>[FastText][5]</cite> (Facebook)

### Test idea : Use of <cite>[GPT-2][6]</cite> to see if it is working correctly. 

## Uses of a Meta-Model
Algorithm for the selection of the best model.
- Which clustering models would be the most relevant? 
- Do we need to select it in the function of the users?
- Would it be a good idea to switch models randomly in order to create noise in the clustering and vary the recommended people.


## Citations
[1]: https://fr.wikipedia.org/wiki/Analyse_en_composantes_principales
[2]: https://fr.wikipedia.org/wiki/Algorithme_t-SNE
[3]: https://github.com/tmikolov/word2vec
[4]: https://github.com/stanfordnlp/GloVe
[5]: https://github.com/facebookresearch/fastText
[6]: https://github.com/openai/gpt-2