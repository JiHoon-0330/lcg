# LCG (Linear + Claude + Git)

Linear 이슈 확인 → Git worktree 생성 → Claude Code로 개발
→ PR 생성까지의 반복 워크플로우를 하나의 CLI로 자동화합니다.

```bash
lcg init            # 초기 설정
lcg issues          # 내 이슈 확인
lcg start LIN-123   # worktree + 브랜치 생성, CLAUDE.md 자동 생성
lcg work LIN-123    # Claude Code 세션 열기
lcg done LIN-123    # PR 생성 + Linear 상태 업데이트
lcg clean LIN-123   # worktree 정리
lcg status          # 활성 worktree 현황
lcg update          # LCG 자체 업데이트
```

## 사전 요구사항

- **Node.js** >= 20
- **pnpm** (패키지 매니저)
- **Git** (worktree 기능 사용)
- **[GitHub CLI][gh]** — PR 생성에 사용.
  `gh auth login`으로 인증 필요
- **[Claude Code CLI][claude]** — AI 코딩 세션에 사용
- **[Linear API 키][linear-api]** —
  Settings > Security & Access > API에서 발급

[gh]: https://cli.github.com/
[claude]: https://docs.anthropic.com/en/docs/claude-code
[linear-api]: https://linear.app/settings/account/security

## 설치

```bash
git clone <repo-url>
cd lcg
pnpm install
pnpm build
pnpm link --global
```

설치가 끝나면 어디서든 `lcg` 명령어를 사용할 수
있습니다.

> `pnpm link --global` 실행 시
> `ERR_PNPM_NO_GLOBAL_BIN_DIR` 에러가 발생하면
> 글로벌 bin 디렉토리가 아직 설정되지 않은 것입니다.
> 아래 명령으로 설정한 뒤 다시 시도하세요:
>
> ```bash
> pnpm setup
> source ~/.zshrc   # 또는 source ~/.bashrc
> pnpm link --global
> ```

## 초기 설정

프로젝트에서 LCG를 처음 사용할 때 `init`을 실행합니다.

```bash
lcg init
```

대화형 프롬프트가 순서대로 진행됩니다:

1. **Linear API 키 입력** — 키가 유효한지 자동 검증
2. **팀 선택** — Linear 워크스페이스의 팀 목록에서 선택
3. **계정 선택** — 해당 팀 멤버 목록에서 본인 계정 선택
4. **Worktree 루트 디렉토리** —
   worktree들이 생성될 상위 경로 (기본값: 현재 디렉토리)
5. **디폴트 브랜치명** — `main` 또는 `master` 등.
   이 이름의 폴더가 worktree 루트 안에 git repo로
   존재해야 합니다

`lcg init`은 `<worktree-root>/<default-branch>` 경로가
유효한 git repo인지 자동 검증합니다.

이미 설정한 적이 있다면 기존 값이 각 프롬프트의
기본값으로 표시되므로, Enter만 눌러 유지할 수 있습니다.
`.lcg.json`의 `claudeMdTemplate` 등 기존 설정도
덮어쓰지 않고 보존됩니다.

디렉토리 구조 예시:

```text
~/worktrees/           ← worktree 루트 (lcg init 실행 위치)
  .lcg.json            ← 프로젝트 설정
  main/                ← 디폴트 브랜치 = 원본 git repo
    src/
    ...
  LIN-123/             ← lcg start로 생성되는 worktree
  LIN-456/             ← lcg start로 생성되는 worktree
```

완료되면 두 개의 설정 파일이 생성됩니다:

| 파일          | 위치                          | 내용                         |
| ------------- | ----------------------------- | ---------------------------- |
| 글로벌 설정   | `~/.config/lcg/config.json`   | API 키, repo 경로, 사용자 ID |
| 프로젝트 설정 | `<worktree-root>/.lcg.json`   | 팀 ID, 브랜치, 템플릿        |

> `.lcg.json`은 worktree 루트에 저장됩니다.
> API 키는 포함되지 않습니다.

## 명령어

### `lcg issues` (별칭: `lcg ls`)

자신에게 할당된 Linear 이슈를 상태별로 그룹화하여
표시합니다.

```bash
lcg issues                         # 현재 팀의 내 이슈
lcg issues --all                   # 모든 팀의 내 이슈
lcg issues --status "In Progress"  # 특정 상태만 필터
lcg issues --team <team-id>        # 특정 팀의 이슈
```

출력 예시:

```text
Todo
  LIN-123  사용자 인증 구현      High
  LIN-125  에러 핸들링 개선      Medium

In Progress
  LIN-124  대시보드 API 연동     High   ← worktree active
```

활성 worktree가 있는 이슈는 표시가 따로 됩니다.

---

### `lcg start <issue-id>`

이슈 작업을 시작합니다. Git worktree와 브랜치를 생성하고,
Claude Code가 읽을 `CLAUDE.md`를 자동 생성합니다.

```bash
lcg start LIN-123
lcg start LIN-123 --skip-design  # 설계 메모 건너뛰기
```

실행 흐름:

1. Linear에서 이슈 정보를 가져와 터미널에 표시
2. 설계 메모를 추가할지 물어봄
   (구현 방향, 기술 스택, 주의사항 등)
3. `git worktree add`로 격리된 작업 디렉토리 생성
4. 이슈 컨텍스트 + 설계 메모가 담긴 `CLAUDE.md` 생성
5. Linear 이슈 상태를 **In Progress**로 변경

worktree 루트에 이슈 ID로 디렉토리가 생성됩니다:

```text
~/worktrees/
  main/              ← 원본 repo (디폴트 브랜치)
  LIN-123/           ← 새로 생성된 worktree
    CLAUDE.md        ← 이슈 컨텍스트가 담긴 파일
    src/
    ...
```

> worktree를 사용하므로 여러 이슈를 동시에 작업할 수
> 있습니다. 각 worktree는 독립된 작업 디렉토리입니다.

---

### `lcg work <issue-id>`

해당 이슈의 worktree 디렉토리에서
Claude Code 세션을 엽니다.

```bash
lcg work LIN-123
```

세 가지 작업 모드를 선택할 수 있습니다:

| 모드                       | 설명                                |
| -------------------------- | ----------------------------------- |
| **Start Implementation**   | CLAUDE.md 컨텍스트와 함께 바로 코딩 |
| **Design Discussion**      | 설계/아키텍처 논의부터 시작         |
| **Edit Design Notes**      | `$EDITOR`로 CLAUDE.md를 직접 수정   |

Claude Code는 worktree 디렉토리의 `CLAUDE.md`를 자동으로
읽어 이슈 맥락을 파악합니다.

---

### `lcg status` (별칭: `lcg st`)

현재 활성화된 모든 worktree의 상태를 보여줍니다.

```bash
lcg status
```

출력 예시:

```text
Active Worktrees:
  LIN-123  feat/user-auth       +142 -23  (3 files)
           사용자 인증 구현
  LIN-124  feat/dashboard-api    +58  -5  (2 files)
           대시보드 API 연동
```

각 worktree의 브랜치명, 코드 변경량(git diff),
Linear 이슈 제목을 한눈에 확인할 수 있습니다.

---

### `lcg done <issue-id>`

작업을 마무리합니다. 브랜치를 push하고 PR을 생성한 뒤,
Linear 이슈 상태를 업데이트합니다.

```bash
lcg done LIN-123
```

실행 흐름:

1. worktree에 새 커밋이 있는지 확인
2. 브랜치를 remote에 push
3. `gh pr create`로 PR 생성
   (제목/본문은 Linear 이슈 기반으로 자동 작성)
4. Linear 이슈 상태를 **In Review**로 변경
5. PR URL과 Linear 이슈 URL 출력

> `gh` CLI가 설치 및 인증되어 있어야 합니다.

---

### `lcg clean <issue-id>`

작업이 끝난 worktree를 정리합니다.

```bash
lcg clean LIN-123
```

확인 프롬프트 후:

1. Git worktree 삭제
2. 로컬 브랜치 삭제 여부를 추가로 물어봄

---

### `lcg update`

LCG 자체를 최신 버전으로 업데이트합니다.

```bash
lcg update
```

LCG가 설치된 디렉토리를 자동으로 찾아
`git pull` → `pnpm install` → `pnpm build`를
순서대로 실행합니다. 완료 후 업데이트된 버전이
표시됩니다.

## 전체 워크플로우 예시

```bash
# 1. 초기 설정 (최초 1회)
lcg init

# 2. 할당된 이슈 확인
lcg issues

# 3. 이슈 작업 시작 — worktree 생성
lcg start LIN-123

# 4. Claude Code로 개발
lcg work LIN-123
#   → "Start Implementation" 선택
#   → Claude와 대화하며 코딩
#   → 완료 후 Claude 세션 종료

# 5. (선택) 다른 이슈를 병렬로 작업
lcg start LIN-456
lcg work LIN-456

# 6. 진행 상황 확인
lcg status

# 7. 작업 완료 — PR 생성
lcg done LIN-123

# 8. worktree 정리
lcg clean LIN-123
```

## 프로젝트 구조

```text
lcg/
├── src/
│   ├── index.ts           # CLI 진입점 (commander)
│   ├── commands/
│   │   ├── init.ts        # lcg init
│   │   ├── issues.ts      # lcg issues
│   │   ├── start.ts       # lcg start
│   │   ├── work.ts        # lcg work
│   │   ├── status.ts      # lcg status
│   │   ├── done.ts        # lcg done
│   │   ├── clean.ts       # lcg clean
│   │   └── update.ts      # lcg update
│   ├── lib/
│   │   ├── linear.ts      # Linear API SDK 래퍼
│   │   ├── git.ts         # Git/worktree 조작
│   │   ├── claude.ts      # Claude Code CLI 실행
│   │   └── config.ts      # 설정 파일 읽기/쓰기
│   ├── types/
│   │   └── index.ts       # 공통 타입 정의
│   └── __tests__/         # vitest 테스트
├── package.json
├── tsconfig.json
└── tsup.config.ts         # 번들링 설정
```

## 개발

```bash
# 개발 모드로 실행 (빌드 없이)
pnpm dev <command>

# 타입 체크
pnpm typecheck

# 테스트
pnpm test

# 테스트 (watch 모드)
pnpm test:watch

# 프로덕션 빌드
pnpm build
```

## 설정 파일 참고

### 글로벌 설정 (`~/.config/lcg/config.json`)

```json
{
  "linearApiKey": "lin_api_...",
  "defaultWorktreeDir": "/Users/you/worktrees",
  "repoPath": "/Users/you/worktrees/main",
  "linearUserId": "user-uuid"
}
```

### 프로젝트 설정 (`.lcg.json`)

`claudeMdTemplate` 필드에 `CLAUDE.md` 생성 템플릿을
지정합니다. `lcg init` 시 기본 템플릿이 자동 생성되며,
이후 직접 수정할 수 있습니다.

템플릿에서 사용 가능한 변수:

| 변수               | 설명                              |
| ------------------ | --------------------------------- |
| `{{identifier}}`   | 이슈 ID (예: `LIN-123`)          |
| `{{title}}`        | 이슈 제목                         |
| `{{description}}`  | 이슈 설명                         |
| `{{comments}}`     | 이슈 댓글 목록                    |
| `{{designNotes}}`  | `lcg start` 시 입력한 설계 메모   |

## 라이선스

MIT
