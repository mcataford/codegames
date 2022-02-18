import { promises as fs } from 'fs'
import * as childProcess from 'child_process'
import util from 'util'

import { Octokit } from '@octokit/core'

import { Context } from './types'

const exec = util.promisify(childProcess.exec)

const EXEC_TIMEOUT = 5000

let octoClient: Octokit | undefined

function getOctokit() {
    if (octoClient) return octoClient

    octoClient = new Octokit({
        auth: process.env.GITHUB_TOKEN,
    })

    return octoClient
}

export async function getPullDetails(
    repoOwner: string,
    repoName: string,
    pullNumber: number,
): Promise<{ author: string; branchName: string }> {
    const client = getOctokit()

    const response = await client.request(
        `GET /repos/${repoOwner}/${repoName}/pulls/${pullNumber}`,
    )

    const branchName = response.data.head.ref
    const author = response.data.head.user.login

    return { author, branchName }
}

export async function getBranchDetails(
    repoOwner: string,
    repoName: string,
    branchName: string,
): Promise<{ author: string; branchName: string }> {
    const client = getOctokit()

    const response = await client.request(
        `GET /repos/${repoOwner}/${repoName}/branches/${branchName}`,
    )

    const author = response.data.commit.author.login

    return { author, branchName }
}

export async function getIssueComment(context: Context): Promise<string> {
    const client = getOctokit()

    const response = await client.request(
        `GET /repos/${context.repoOwner}/${context.repoName}/issues/comments/${context.commentId}`,
    )

    return response.data.body
}

export async function upsertIssueComment(
    context: Context,
    body: string,
): Promise<number> {
    const client = getOctokit()

    if (context.commentId) {
        await client.request(
            `PATCH /repos/${context.repoOwner}/${context.repoName}/issues/comments/${context.commentId}`,
            {
                owner: context.repoOwner,
                repo: context.repoName,
                issue_number: context.pullNumber,
                body,
            },
        )

        return context.commentId
    } else {
        const response = await client.request(
            `POST /repos/${context.repoOwner}/${context.repoName}/issues/${context.pullNumber}/comments`,
            {
                owner: context.repoOwner,
                repo: context.repoName,
                issue_number: context.pullNumber,
                body,
            },
        )

        const commentId = response.data.id
        return commentId
    }
}

/*
 * readJSON abstracts synchronous reading from the given file
 * and returning the parsed output, provided it is JSON-compliant.
 */
export async function readJSON<T>(path: string): Promise<T> {
    const raw = await fs.readFile(path, { encoding: 'utf8' })
    return JSON.parse(raw)
}

/*
 * writeJSON abstracts asynchronous writing to JSON files. The data
 * should be JSON-serializable.
 */
export async function writeJSON(path: string, data: object): Promise<void> {
    await fs.writeFile(path, JSON.stringify(data))
}

/*
 * Runs a command in shell with predefined options.
 */
export async function shellExec(command: string): Promise<{
    stdout: string
    stderr: string
}> {
    return await exec(command, { timeout: EXEC_TIMEOUT })
}

/*
 * Collect branch and checks it out at <targetPath>.
 */
export async function collectBranch(
    branchName: string,
    targetPath: string,
): Promise<void> {
    await exec(`git worktree add ${targetPath} ${branchName} -f`)
}
