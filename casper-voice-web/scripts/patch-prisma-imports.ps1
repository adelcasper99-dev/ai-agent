$files = @(
  'lib/telegram_llm.ts',
  'lib/telegram_fallback.ts',
  'lib/whisper_prompt.ts',
  'lib/llm_correction.ts'
)

foreach ($f in $files) {
  if (Test-Path $f) {
    $c = Get-Content $f -Raw
    $c = $c -replace 'import \{ PrismaClient \} from "@prisma/client";?\r?\n', ''
    $c = $c -replace "import \{ PrismaClient \} from '@prisma/client';?\r?\n", ''
    $c = $c -replace 'const prisma = new PrismaClient\(\);?\r?\n', ''
    if ($c -notmatch 'import \{ prisma \} from') {
      $c = 'import { prisma } from "@/lib/prisma";' + [Environment]::NewLine + $c
    }
    Set-Content $f $c -NoNewline
    Write-Host "PATCHED: $f"
  } else {
    Write-Host "SKIP: $f"
  }
}
Write-Host "Done."
