import gamesManifest from '@codegames/games'

import {
    ContextualizedError,
    getBranchDetails,
    getPullDetails,
    upsertIssueComment,
    writeJSON,
} from './utils'
import { Context, GameManifest, GitContext } from './types'

const FAILED_TO_PARSE_ERR =
    'Failed to parse challenge. The expected format is "I challenge `branch` at `game`.".'
const INVALID_GAME_ERR = 'Unrecognized game identifier.'
/*
 * prepareChallenge gathers basic information about the challenge
 * and commits it to disk.
 */
async function prepareChallenge(
    repo: string,
    runnerBranch: string,
    pullNumber: number,
    challengeComment: string,
): Promise<void> {
    const [repoOwner, repoName] = repo.split('/')

    const pattern =
        /^(I|i) challenge (?<other>[A-Za-z0-9-/]+) at (?<game>([A-Za-z0-9-]+))$/
    const match = challengeComment.match(pattern)?.groups

    if (!match?.other || !match?.game)
        throw new ContextualizedError<GitContext>(FAILED_TO_PARSE_ERR, {
            repoOwner,
            repoName,
            pullNumber,
        })

    const gameDetails = (gamesManifest as GameManifest)[match.game]

    if (!gameDetails)
        throw new ContextualizedError(INVALID_GAME_ERR, {
            repoOwner,
            repoName,
            pullNumber,
        })

    const [challengerDetails, challengeeDetails] = await Promise.all([
        getPullDetails(repoOwner, repoName, pullNumber),
        getBranchDetails(repoOwner, repoName, String(match.other)),
    ])

    const { author: challenger, branchName: challengerBranch } =
        challengerDetails
    const { author: challengee, branchName: challengeeBranch } =
        challengeeDetails

    console.group('Challenge summary')

    const message = `# 💀 Two players enter the arena, only one will leave 💀\n## ${challenger}'s \`${challengerBranch}\` v. ${challengee}'s \`${challengeeBranch}\`\n:ballot_box_with_check: Prepare challenge`

    const challengeData: Context = {
        pullNumber,
        repoName,
        repoOwner,
        runnerBranch,
        challenger,
        challengerBranch,
        challengee,
        challengeeBranch,
        game: match.game,
        gameDetails,
    }
    const commentId = await upsertIssueComment(
        repoOwner,
        repoName,
        pullNumber,
        message,
    )

    challengeData.commentId = commentId

    console.log(JSON.stringify(challengeData, null, 2))
    console.groupEnd()

    await writeJSON('./challengeContext.json', challengeData)
}

const [, , repo, runnerBranch, currentBranch, challengeComment] = process.argv

prepareChallenge(
    repo,
    runnerBranch,
    Number(currentBranch),
    challengeComment,
).catch(async (e) => {
    console.error('Could not parse challenge!')
    console.error(e)
    await upsertIssueComment(
        e.extra.repoOwner,
        e.extra.repoName,
        e.extra.pullNumber,
        `💥 Oh no! ${e.message}`,
    )

    process.exit(1)
})
