import { promises as fs } from 'fs'
import * as childProcess from 'child_process'
import util from 'util'

import { Octokit } from '@octokit/core'

import { Context } from './types'

const exec = util.promisify(childProcess.exec)
const execFile = util.promisify(childProcess.execFile)

const EXEC_TIMEOUT = 5000

let octoClient: Octokit | undefined

function getOctokit() {
    if (octoClient) return octoClient

    octoClient = new Octokit({
        auth: process.env.GITHUB_TOKEN,
    })

    return octoClient
}

export class ContextualizedError<Extra> extends Error {
    extra: Extra

    constructor(message: string, extra: Extra) {
        super(message)
        this.extra = extra
    }
}

export function setupTimers(): {
    addMark: (label: string) => void
    timeBetween: (a: string, b: string) => number | undefined
} {
    const marks = new Map<string, BigInt>()

    const addMark = (label: string) => {
        marks.set(label, process.hrtime.bigint())
    }

    const timeBetween = (start: string, end: string): number | undefined => {
        if (!marks.has(start) || !marks.has(end))
            throw new Error(`Invalid timer marks (${start} > ${end}).`)

        const startMark = marks.get(start)
        const endMark = marks.get(end)

        return Number(
            ((Number(endMark) - Number(startMark)) / 10 ** 9).toFixed(3),
        )
    }

    return { addMark, timeBetween }
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
    repoOwner: string,
    repoName: string,
    pullNumber: number,
    body: string,
    commentId?: number,
): Promise<number> {
    const client = getOctokit()

    const payload = {
        owner: repoOwner,
        repo: repoName,
        issue_number: pullNumber,
        body,
    }

    const url = commentId
        ? `PATCH /repos/${repoOwner}/${repoName}/issues/comments/${commentId}`
        : `POST /repos/${repoOwner}/${repoName}/issues/${pullNumber}/comments`

    const response = await client.request(url, payload)

    return response.data.id
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
export async function runScript(
    runner: string,
    path: string,
    args?: (string | object)[],
    debug?: boolean,
): Promise<{
    stdout: string
    stderr: string
}> {
    const castedArgs =
        args?.map((arg: string | object): string => {
            if (typeof arg === 'object') return JSON.stringify(arg)

            return arg
        }) ?? []

    if (debug) {
        console.group('runScript')
        console.log(`Runner: ${runner}\nPath: ${path}\nArgs: ${castedArgs}`)
        console.groupEnd()
    }

    const forbiddenEnv = /^(GITHUB_.*)$/
    const sanitizedEnv = Object.entries(process.env).reduce(
        (
            newEnv: { [key: string]: string | undefined },
            [envKey, envValue]: [string, string | undefined],
        ) => {
            if (!envKey.match(forbiddenEnv)) newEnv[envKey] = envValue

            return newEnv
        },
        {} as { [key: string]: string | undefined },
    )

    return await execFile(runner, [path, ...castedArgs], {
        timeout: EXEC_TIMEOUT,
        env: sanitizedEnv,
    })
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
