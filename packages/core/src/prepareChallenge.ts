import gamesManifest from '@codegames/games'

import {
    ContextualizedError,
    getPullDetails,
    upsertIssueComment,
    writeJSON,
} from './utils'
import { Context, GameManifest, GitContext } from './types'

const FAILED_TO_PARSE_ERR =
    'Failed to parse message. The expected format is "Let\'s play [game]".'
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

    const soloPattern = /^(L|l)et's play (?<game>([A-Za-z0-9-]+))$/
    const match = challengeComment.match(soloPattern)?.groups

    if (!match?.game)
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

    const { author, branchName } = await getPullDetails(
        repoOwner,
        repoName,
        pullNumber,
    )
    console.group('Challenge summary')

    const message = `# 🏁 A challenger appears 🏁\n## ${author}'s \`${branchName}\` playing \`${match.game}\`\n:ballot_box_with_check: Prepare challenge`

    const challengeData: Context = {
        pullNumber,
        repoName,
        repoOwner,
        runnerBranch,
        challenger: author,
        challengerBranch: branchName,
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
