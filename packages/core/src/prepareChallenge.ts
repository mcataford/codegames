import {
    getBranchDetails,
    getPullDetails,
    upsertIssueComment,
    writeJSON,
} from './utils'
import { Context } from './types'

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

    const pattern = /^(I|i) challenge (?<other>[A-Za-z0-9-]+)$/
    const match = challengeComment.match(pattern)?.groups

    if (!match?.other) throw Error('Instructions unclear. >:(')

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
    }
    const commentId = await upsertIssueComment(challengeData, message)

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
).catch((e) => {
    console.error('Could not parse challenge!')
    console.error(e)
    process.exit(1)
})
