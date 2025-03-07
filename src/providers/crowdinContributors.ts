import type { Credentials, ReportsModel } from '@crowdin/crowdin-api-client'
import type { Provider, Sponsorship } from '../types'
import { ProjectsGroups, Reports } from '@crowdin/crowdin-api-client'

interface Member {
  id: number
  username: string
  fullName: string
  avatarUrl: string
  joinedAt: string
}

export const CrowdinContributorsProvider: Provider = {
  name: 'crowdinContributors',
  fetchSponsors(config) {
    return fetchCrowdinContributors(
      config.crowdinContributors?.token || config.token!,
      config.crowdinContributors?.projectId || 0,
      config.crowdinContributors?.minTranslations || 1,
    )
  },
}

export async function fetchCrowdinContributors(
  token: string,
  projectId: number,
  minTranslations = 1,
): Promise<Sponsorship[]> {
  if (!token)
    throw new Error('Crowdin token is required')
  if (!projectId)
    throw new Error('Crowdin project ID is required')

  const credentials: Credentials = {
    token,
  }

  // get the project
  const projectsGroups: ProjectsGroups = new ProjectsGroups(credentials)
  const project = await projectsGroups.getProject(projectId)

  // get top members report
  const reports: Reports = new Reports(credentials)

  // today's date in ISO 8601 format
  const dateTo = new Date().toISOString()
  const dateFrom = project.data.createdAt

  const createReportRequestBody: ReportsModel.GenerateReportRequest = {
    name: 'top-members',
    schema: {
      unit: 'words',
      format: 'json',
      dateFrom,
      dateTo,
    },
  }

  const createReport = await reports.generateReport(projectId, createReportRequestBody)

  // get the report
  // sleep for 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000))
  const report = await reports.downloadReport(projectId, createReport.data.identifier)

  // build contributors object from looping over the report data
  const reportRaw = await fetch(report.data.url)
  const reportData = await reportRaw.json() as { data: { user: Member, translated: number }[] }

  const contributors = reportData.data
    .filter((entry: { user: Member, translated: number }) => entry.translated > minTranslations)
    .map((entry: { user: Member, translated: number }) => ({
      member: entry.user,
      translations: entry.translated,
    }))

  return contributors
    .filter(Boolean)
    .map(({ member, translations }: { member: Member, translations: number }) => ({
      sponsor: {
        type: 'User',
        login: member.username,
        name: member.username, // fullName is also available
        avatarUrl: member.avatarUrl,
        linkUrl: `https://crowdin.com/profile/${member.username}`,
      },
      isOneTime: false,
      monthlyDollars: translations,
      privacyLevel: 'PUBLIC',
      tierName: 'Translator',
      createdAt: member.joinedAt,
      provider: 'crowdinContributors',
    }))
}
