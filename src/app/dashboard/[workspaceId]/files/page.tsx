import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { AssetVaultClient, type AssetItem } from './AssetVaultClient'

interface Props {
  params: Promise<{ workspaceId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single()
  return { title: data ? `${data.name} — Assets` : 'Assets' }
}

export default async function WorkspaceFilesPage({ params }: Props) {
  const { workspaceId } = await params
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Fetch assets — newest first
  const { data: rawAssets } = await supabase
    .from('workspace_assets')
    .select('id, file_name, storage_path, file_size, file_type, category, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  const assets = rawAssets ?? []

  // Generate preview signed URLs for image assets in one batch call
  const imagePaths = assets
    .filter((a) => a.file_type.startsWith('image/'))
    .map((a) => a.storage_path)

  let previewUrlMap: Record<string, string | null> = {}

  if (imagePaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from('workspace_assets')
      .createSignedUrls(imagePaths, 3600)

    if (signedUrls) {
      previewUrlMap = Object.fromEntries(
        signedUrls.map((d) => [d.path, d.signedUrl ?? null])
      )
    }
  }

  // Shape the data for the client component
  const initialAssets: AssetItem[] = assets.map((a) => ({
    ...a,
    previewUrl: previewUrlMap[a.storage_path] ?? null,
  }))

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-6 py-6 md:py-8">

        {/* ── Heading ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-black tracking-tight">Asset Vault</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Brand files, guidelines, and source assets for this project.
          </p>
        </div>

        {/* ── Client component handles filtering, upload, download ──────── */}
        <AssetVaultClient
          workspaceId={workspaceId}
          initialAssets={initialAssets}
          isAdmin={isAdmin}
        />

      </div>
    </div>
  )
}
