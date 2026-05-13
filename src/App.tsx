import { useEffect, useState } from 'react';
import { AppSidebar } from './components/AppSidebar';
import { useProfessorDirectory } from './hooks/useProfessorDirectory';
import { getDesktopApi } from './lib/desktop';
import { createTimelineEvent } from './lib/timeline';
import { ProfessorDirectoryPage } from './pages/ProfessorDirectoryPage';
import { SchoolDirectoryPage } from './pages/SchoolDirectoryPage';
import type { ProfessorDraft } from './types/professor';
import type { TimelineEventDraft } from './types/timeline';

type View = 'contacts' | 'schools' | 'trash';

function formatUpdateErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');
  const message = rawMessage
    .replace(/^Error invoking remote method 'system:(?:check-for-updates|install-update)':\s*/i, '')
    .trim();
  const lowerMessage = message.toLowerCase();

  if (/aborterror|aborted|timeout|timed out|超时/.test(lowerMessage)) {
    return '检查更新失败：更新地址访问超时。可能是当前网络访问 GitHub 或 CDN 较慢，请稍后重试，或直接打开 GitHub Release 下载新版。';
  }

  if (/failed to fetch|fetch failed|network|dns|enotfound|econnreset|econnrefused|etimedout|eai_again|socket/.test(lowerMessage)) {
    return '检查更新失败：网络连接失败。请检查网络、代理，或确认 GitHub/CDN 当前可以访问。';
  }

  if (/404|not found/.test(lowerMessage)) {
    return '检查更新失败：更新文件没有找到。可能是 latest.json 还没有发布，或 CDN 缓存还没有刷新。';
  }

  if (/401|unauthorized/.test(lowerMessage)) {
    return '检查更新失败：更新地址需要授权访问。请确认 Release 仓库和下载文件是公开的。';
  }

  if (/403|forbidden|rate limit|rate exceeded/.test(lowerMessage)) {
    return '检查更新失败：GitHub 暂时拒绝访问或触发访问频率限制，请稍后再试。';
  }

  if (/5\d{2}|bad gateway|service unavailable|gateway timeout/.test(lowerMessage)) {
    return '检查更新失败：更新服务器暂时不可用，请稍后重试。';
  }

  if (/json|manifest|version|unexpected token/.test(lowerMessage)) {
    return '检查更新失败：更新配置文件格式不正确。请检查 latest.json 里的版本号和下载链接。';
  }

  if (/url|protocol/.test(lowerMessage)) {
    return '检查更新失败：更新地址格式不正确。请检查 UPDATE_MANIFEST_URL 或 latest.json 的下载链接。';
  }

  return message ? `检查更新失败：${message}` : '检查更新失败：未知错误。';
}

export default function App() {
  const [view, setView] = useState<View>('contacts');
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const professorDirectory = useProfessorDirectory();

  const checkForUpdates = async (manual = true) => {
    const desktopApi = getDesktopApi();
    if (!desktopApi) {
      if (manual) {
        setUpdateMessage('网页预览模式不能检查桌面版更新。');
      }
      return;
    }

    setIsCheckingUpdates(true);
    try {
      const result = await desktopApi.system.checkForUpdates();

      if (!result.configured) {
        if (manual) {
          setUpdateMessage('还没有配置更新地址。配置 UPDATE_MANIFEST_URL 后重新打包即可启用。');
        }
        return;
      }

      if (!result.updateAvailable) {
        if (manual) {
          setUpdateMessage(`当前已经是最新版：${result.currentVersion}`);
        }
        return;
      }

      const targetUrl = result.downloadUrl || result.releaseUrl;
      const message = result.downloadUrl
        ? `发现新版本 ${result.latestVersion}，当前版本 ${result.currentVersion}。${result.notes ? `\n\n${result.notes}` : ''}\n\n是否下载并启动新版安装程序？当前程序会在安装程序启动后退出。`
        : `发现新版本 ${result.latestVersion}，当前版本 ${result.currentVersion}。${result.notes ? `\n\n${result.notes}` : ''}\n\n没有找到安装包直链，是否打开发布页面？`;
      const shouldOpen = window.confirm(message);
      setUpdateMessage(`发现新版本 ${result.latestVersion}`);
      if (shouldOpen && result.downloadUrl) {
        setUpdateMessage('正在下载新版安装程序。下载完成后会启动安装程序并关闭当前程序。');
        await desktopApi.system.installUpdate(result.downloadUrl);
      } else if (shouldOpen && targetUrl) {
        await desktopApi.system.openExternalUrl(targetUrl);
      }
    } catch (error) {
      if (manual) {
        setUpdateMessage(formatUpdateErrorMessage(error));
      }
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  useEffect(() => {
    void checkForUpdates(false);
  }, []);

  const handleCreateProfessor = async (draft: ProfessorDraft) => {
    await professorDirectory.create(draft);
  };

  const handleUpdateProfessor = async (id: string, draft: ProfessorDraft) => {
    await professorDirectory.update(id, draft);
  };

  const handleCreateTimelineEvent = async (draft: TimelineEventDraft) => {
    await createTimelineEvent(draft);

    const professor = professorDirectory.professors.find((record) => record.id === draft.professorId);
    if (!professor) {
      return;
    }

    let nextStatus = professor.status;
    if (draft.type === 'Initial Outreach') {
      nextStatus = 'Contacted';
    } else if (draft.type === 'Follow-Up') {
      nextStatus = 'Follow-Up Due';
    } else if (draft.type === 'Reply') {
      nextStatus = 'Replied';
    }

    const nextFirstContactDate =
      draft.type === 'Initial Outreach' && !professor.firstContactDate
        ? draft.eventDate
        : professor.firstContactDate;

    const nextLastContactDate =
      draft.type === 'Note'
        ? professor.lastContactDate
        : professor.lastContactDate && professor.lastContactDate > draft.eventDate
          ? professor.lastContactDate
          : draft.eventDate;

    await professorDirectory.update(professor.id, {
      name: professor.name,
      title: professor.title,
      school: professor.school,
      email: professor.email,
      homepage: professor.homepage,
      researchArea: professor.researchArea,
      status: nextStatus,
      tags: professor.tags,
      firstContactDate: nextFirstContactDate,
      lastContactDate: nextLastContactDate,
      notes: professor.notes,
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-paper text-ink selection:bg-accent/20">
      <AppSidebar
        view={view}
        onChangeView={setView}
        updateMessage={updateMessage}
        isCheckingUpdates={isCheckingUpdates}
        onCheckUpdates={() => void checkForUpdates(true)}
      />

      <main className="min-w-0 flex-1 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(177,95,47,0.08),_transparent_28%),linear-gradient(180deg,#fcfbf8_0%,#f7f4ef_100%)]">
        {view === 'schools' ? (
          <SchoolDirectoryPage
            professors={professorDirectory.professors}
            isLoading={professorDirectory.isLoading}
            error={professorDirectory.error}
            onCreateProfessor={handleCreateProfessor}
            onUpdateProfessor={handleUpdateProfessor}
            onTrashProfessor={professorDirectory.moveToTrash}
            onCreateTimelineEvent={handleCreateTimelineEvent}
          />
        ) : (
          <ProfessorDirectoryPage
            mode={view === 'contacts' ? 'active' : 'trash'}
            professors={professorDirectory.professors}
            isLoading={professorDirectory.isLoading}
            error={professorDirectory.error}
            onCreateProfessor={handleCreateProfessor}
            onUpdateProfessor={handleUpdateProfessor}
            onTrashProfessor={professorDirectory.moveToTrash}
            onRestoreProfessor={professorDirectory.restore}
            onPurgeProfessor={professorDirectory.purge}
            onCreateTimelineEvent={handleCreateTimelineEvent}
            onImportProfessors={professorDirectory.importRecords}
          />
        )}
      </main>
    </div>
  );
}
