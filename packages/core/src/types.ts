export interface Context {
    repoName: string
    repoOwner: string
    runnerBranch: string
    pullNumber: number
    challenger: string
    challengerBranch: string
    challengee: string
    challengeeBranch: string
    commentId?: number
}

export interface RunnableConfig {
    runnerType: 'node'
    runnerPath: string
}
