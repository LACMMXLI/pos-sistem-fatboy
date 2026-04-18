import { ServerConnectionPanel } from '@/components/settings/ServerConnectionPanel';

interface ServerConnectionSetupScreenProps {
  mode?: string | null;
  reason?: string | null;
  errorMessage?: string | null;
}

export function ServerConnectionSetupScreen({
  mode,
  reason,
  errorMessage,
}: ServerConnectionSetupScreenProps) {
  return (
    <div className="admin-shell min-h-screen px-4 py-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-3xl items-center justify-center">
        <ServerConnectionPanel
          standalone
          setupMode={mode === 'setup'}
          startupReason={reason}
          startupError={errorMessage}
        />
      </div>
    </div>
  );
}
