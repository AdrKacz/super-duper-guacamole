**Version 0**

# Model to assign people to conversation groups

## Introduction
One of the main idea of the project is to develop a software solution to assign people **apparently randomly** to conversation groups. However, we aim to create groups which have a positive dynamic, hence, an automatic learning answering to 'how to assign people' is required. In a distributed architecture, we haven't access to people information globally, so we have to do everything 'locally'.


# Local information available
Each individual has access to :

- Its own ID
- The ID of the people he has talked with
- The message that were exchange in the different conversations he was involved in.

If a conversation is composed of m members : All of those members know each others (access to the m ID) and the messages exchanged.

# Create a new conversation
Lets first introduce the notion of **Relationship representation**.

## Relationship private representation
With the local information available (detailled later), we compute scores/weights, of n dim, **in the vision of each ID/individual**. This reprensentation is **PRIVATE**.

e.g : See below, reprensentation in 2D (let's say it is a PCAof the generated weights)
In the vision of e<sub>1</sub>, he is closer to e<sub>3</sub>  than to e<sub>2</sub> , but in the vision of e<sub>3</sub>, e<sub>2</sub> is closer than e<sub>1</sub>. This vision is -or at least can be- **INDIVIDUALS DEPENDENT** (depends of how weights are generated, potential absence of symmetry). 

![img.png](images/rpz-2d.png)


## From Relationship Reprensentation (RR) to recommendations
Hence, to create a new conversation : For conversations of max m individuals, if :
- e<sub>1</sub> knows e<sub>i</sub> for i∈[1,m]
- e<sub>2</sub> is the closest individual to e<sub>1</sub>
- e<sub>2</sub> knows e<sub>j</sub> for j∈[m+1,2m] because he is involved in an other conversation.\
--> **e<sub>2</sub> recommand APPROPRIATE individuals to e<sub>1</sub> (close to him in the e<sub>2</sub> RR**, whom would be unkown for e<sub>1</sub> : He meets new people, with a kind of 'recommendation system'.
Needs to be clear : e<sub>2</sub> only provides a e<sub>j</sub> ID, j∈[m+1,2m], and not his distance to  e<sub>1</sub> in the  e<sub>2</sub> representation. **The RR is private, and is never transmitted in whole**.

To recap :
- Each individual in the e<sub>1</sub> RR will recommend him somebody.
- Sometimes it can be the same individual.
- We will introduce weights that depends of e<sub>1</sub> proximity to the 'recommender' e<sub>i</sub>, i∈[1,m]. (The closest the 'recommender' is, the more we should listen to him, he is a 'close friend').


Below : A graphic illustration of this 'loophole' point of view. \
- Recommendation by e<sub>2</sub> : e<sub>6</sub>
- Recommendation by e<sub>3</sub> : e<sub>4</sub>
- e<sub>4</sub> will have a larger weight than e<sub>6</sub> because e<sub>3</sub> is closer from e<sub>1</sub> than e<sub>2</sub>
![img.png](images/reco-2d.png)



# Main points still to determine :
## Weight the recommendations
2 options are possible :
- Distance (continuous) weighting : Compute d(e<sub>1</sub>, e<sub>i</sub>), where d is an distance to define. Then the weithing term is
- Discrete weighting : Giving the rank of the e<sub>i</sub> in the 'Proximity ranking', we attribute fixed weights. Could be appropriate if we don't have a distance to compute. (Example: In the beginning we could compute logic gates on the weights computed.)


## n-representation Features for clustering system

- Frequency of answer to somebody
- Content of the messages --> Sentiment analysis : Pay attention to the ironie/insults that can skew the results
- Topics identified

### Test : Use GPT-2 to see if it is working correctly.

## Uses of a Meta-Model
- Which clustering models would be the most relevant ? 
- Do we need to select it in function of the individuals ?
- Would it be a good idea to switch models randomly in order to create noise in the clustering and vary the recommended people.