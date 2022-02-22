export enum RunnerType {
    node = 'node',
}
export enum GameOutcomes {
    TIME_OUT = 'time_out',
    WIN = 'win',
    LOSS = 'loss',
    RUNNING = 'running',
}

// FIXME: Dynamic typing using schemas?
export interface PlayerOutput {
    // Move coming from the player script.
    action: any
    // Data stashed between runs by the player
    stash: any
}

// FIXME: Dynamic typing using schemas?
export interface RunnerOutput {
    // Secrets stashed by the game runner
    gameSecrets?: any
    // Public game state
    gameData?: any
    // Runner state
    runnerState?: {
        done: boolean
        outcome: string
    }
}

export enum PlayerLabel {
    P1 = 'player-1',
    P2 = 'player-2',
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
    challengee?: string
    challengeeBranch?: string
    commentId?: number
    game: string
    gameDetails: GameDefinition
}

export interface RunnableConfig {
    runnerType: 'node'
    runnerPath: string
}

export interface PlayerConfigMap {
    [key: string]: RunnableConfig
}
