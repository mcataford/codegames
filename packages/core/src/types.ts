export enum RunnerType {
    node = 'node',
}

export interface GameManifest {
    [key: string]: GameDefinition
}

export interface GameDefinition {
    description: string
    path: string
    runnerType: RunnerType
}

export interface GitContext {
    repoName: string
    repoOwner: string
    pullNumber: number
    commentId?: number
}

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
    game: string
    gameDetails: GameDefinition
}

export interface RunnableConfig {
    runnerType: 'node'
    runnerPath: string
}
