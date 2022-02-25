import * as childProcess from 'child_process'
import util from 'util'

const exec = util.promisify(childProcess.exec)

async function reportSummary(issueNumber: number) {
    await exec(`gh issue comment ${issueNumber} --body ":checkmark: Neat!"`)
}

const issueNumber = Number(process.argv[2])

reportSummary(issueNumber)
