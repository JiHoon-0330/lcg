# LCG (Linear + Claude + Git)

Linear 이슈 확인 → Git worktree 생성 → Claude Code로 개발
→ PR 생성까지의 반복 워크플로우를 하나의 CLI로 자동화합니다.

```bash
lcg init            # 초기 설정
lcg issues          # 내 이슈 확인
lcg start LIN-123   # worktree + 브랜치 생성, Zellij 세션 시작
lcg clean LIN-123   # worktree 정리
lcg status          # 활성 worktree 현황
lcg sync feat/123   # 체이닝된 PR 브랜치 순차 업데이트
lcg update          # LCG 자체 업데이트
```

## 사전 요구사항

- **Node.js** >= 20
- **pnpm** (패키지 매니저)
- **Git** (worktree 기능 사용)
- **[GitHub CLI][gh]** — PR 생성 및 `lcg sync`에 사용.
  `gh auth login`으로 인증 필요
- **[Claude Code CLI][claude]** — AI 코딩 세션에 사용
- **[Zellij][zellij]** — 터미널 멀티플렉서.
  `lcg init` 시 자동 설치 시도 (Homebrew)
- **[Linear API 키][linear-api]** —
  Settings > Security & Access > API에서 발급

[gh]: https://cli.github.com/
[claude]: https://docs.anthropic.com/en/docs/claude-code
[zellij]: https://zellij.dev/
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
6. **Post-setup 스크립트** — worktree 생성 후 실행할
   명령어 (예: `pnpm install`, `npm ci`)

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

> **중요:** `lcg start`, `clean`, `status`, `sync` 등의 명령은
> `.lcg.json`이 있는 디렉터리(또는 하위 디렉터리)에서
> 실행해야 합니다. 여러 레포에 각각 `.lcg.json`을
> 설정하면 독립적으로 사용할 수 있습니다.

완료되면 두 개의 설정 파일이 생성됩니다:

| 파일          | 위치                          | 내용                     |
| ------------- | ----------------------------- | ------------------------ |
| 글로벌 설정   | `~/.config/lcg/config.json`   | API 키, 사용자 ID        |
| 프로젝트 설정 | `<worktree-root>/.lcg.json`   | 팀 ID, 브랜치, 템플릿    |

> `.lcg.json`은 worktree 루트에 저장됩니다.
> API 키는 포함되지 않습니다.

## 명령어

### `lcg issues` (별칭: `lcg ls`)

자신에게 할당된 Linear 이슈를 상태별로 그룹화하여
표시합니다. 이슈를 선택하면 `start` 또는 `clean`
액션을 바로 실행할 수 있습니다.

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

활성 worktree나 Claude 세션이 있는 이슈는 별도 표시됩니다.

---

### `lcg start <issue-id>`

이슈 작업을 시작합니다. Git worktree와 브랜치를 생성하고,
Claude Code가 읽을 `CLAUDE.local.md`를 자동 생성한 뒤,
Zellij 세션 안에서 Claude Code를 시작합니다.

```bash
lcg start LIN-123              # 기본 브랜치 기반으로 시작
lcg start LIN-123 --base canary  # canary 브랜치 기반으로 시작
lcg start LIN-123 --base        # 인터랙티브 브랜치 선택
```

**상태별 동작:**

| 상태 | 조건 | 동작 |
|------|------|------|
| A | 세션/워크트리 없음 | 전체 셋업: 이슈 조회 → 워크트리 생성 → Zellij + Claude 시작 |
| B | Zellij 세션 존재 | 기존 세션에 attach |
| D | 워크트리만 존재 | Zellij 세션 새로 생성 후 Claude 시작 |

**`--base` 옵션:**

- `--base <branch>`: 지정한 브랜치를 베이스로 워크트리 생성
- `--base` (값 없이): 원격 브랜치 목록에서 인터랙티브 검색으로 선택
- 미지정: `.lcg.json`의 `baseBranch` 기본값 사용

실행 흐름 (State A):

1. Linear에서 이슈 정보를 가져와 터미널에 표시
2. Linear 이슈 상태를 **In Progress**로 변경
3. `git worktree add`로 격리된 작업 디렉토리 생성
4. post-setup 스크립트 실행 (설정된 경우)
5. 이슈 컨텍스트가 담긴 `CLAUDE.local.md` 생성
6. Zellij 세션 안에서 Claude Code 시작

```text
~/worktrees/
  main/              ← 원본 repo (디폴트 브랜치)
  LIN-123/           ← 새로 생성된 worktree
    CLAUDE.local.md  ← 이슈 컨텍스트가 담긴 파일
    src/
    ...
```

> worktree를 사용하므로 여러 이슈를 동시에 작업할 수
> 있습니다. 각 worktree는 독립된 작업 디렉토리입니다.

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

### `lcg sync [branch]`

체이닝된 PR 브랜치들을 순차적으로 최신화합니다.
타겟 브랜치의 PR 체인을 루트 base까지 역추적한 뒤,
루트부터 타겟까지 순서대로 부모 브랜치를 merge하고
push합니다.

```bash
lcg sync                # 현재 브랜치 기준
lcg sync feat/pr2       # feat/pr2 브랜치 기준
```

**동작 예시:**

`main ← pr1 ← pr2 ← pr3` 구조에서:

- `lcg sync pr2` → `pr1`에 `main` 최신 반영 후 push,
  `pr2`에 `pr1` 최신 반영 후 push. `pr3`는 건드리지 않음
- `lcg sync pr3` → `pr1`, `pr2`, `pr3` 순서로 모두 업데이트

`main ← c ← c1` / `main ← b ← b1` 구조에서:

- `lcg sync b` → `b`에 `main` 최신 반영 후 push.
  `c`, `c1`, `b1`은 건드리지 않음

실행 흐름:

1. `gh pr list`로 열린 PR들의 base/head 관계 파악
2. 타겟 브랜치에서 루트 base까지 체인 역추적
3. 체인 시각화 후 확인 프롬프트
4. 임시 워크트리에서 순차적으로 `git merge` → `git push`
5. 각 PR의 description을 최신 커밋 목록으로 업데이트
6. 임시 워크트리 자동 정리

> `gh` CLI가 설치 및 인증되어 있어야 합니다.
> merge conflict 발생 시 중단되며 수동 해결을 안내합니다.

---

### `lcg clean <issue-id>`

작업이 끝난 worktree를 정리합니다.

```bash
lcg clean LIN-123
```

확인 프롬프트 후:

1. Zellij 세션 종료
2. Git worktree 삭제
3. 로컬 브랜치 삭제

---

### `lcg config` (별칭: `lcg cfg`)

설정 파일을 기본 에디터로 엽니다.

```bash
lcg config             # 글로벌 + 프로젝트 설정 모두
lcg config --global    # 글로벌 설정만
lcg config --project   # 프로젝트 설정만
```

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

# 3. 이슈 작업 시작 — worktree + Zellij + Claude 시작
lcg start LIN-123

# 4. Zellij 세션에서 Claude와 대화하며 코딩
#    완료 후 Ctrl+Q로 세션 detach

# 5. (선택) 다른 이슈를 병렬로 작업
lcg start LIN-456

# 6. 기존 세션에 다시 접속
lcg start LIN-123   # 기존 세션이 있으면 자동 attach

# 7. 진행 상황 확인
lcg status

# 8. 체이닝된 PR 브랜치 업데이트
lcg sync feat/my-branch

# 9. worktree 정리
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
│   │   ├── setup.ts       # lcg _setup (내부용)
│   │   ├── status.ts      # lcg status
│   │   ├── sync.ts        # lcg sync
│   │   ├── clean.ts       # lcg clean
│   │   ├── config.ts      # lcg config
│   │   └── update.ts      # lcg update
│   ├── lib/
│   │   ├── linear.ts      # Linear API SDK 래퍼
│   │   ├── git.ts         # Git/worktree 조작
│   │   ├── claude.ts      # Claude Code CLI 실행
│   │   ├── zellij.ts      # Zellij 세션 관리
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

# 린트
pnpm lint

# 포맷
pnpm format

# 프로덕션 빌드
pnpm build
```

## 설정 파일 참고

### 글로벌 설정 (`~/.config/lcg/config.json`)

```json
{
  "linearApiKey": "lin_api_...",
  "linearUserId": "user-uuid"
}
```

### 프로젝트 설정 (`.lcg.json`)

```json
{
  "teamId": "team-uuid",
  "teamKey": "LIN",
  "branchPrefix": "",
  "baseBranch": "main",
  "claudeMdTemplate": "# {{identifier}} - {{title}}\n...",
  "postSetup": "pnpm install"
}
```

`claudeMdTemplate` 필드에 `CLAUDE.local.md` 생성 템플릿을
지정합니다. `lcg init` 시 기본 템플릿이 자동 생성되며,
이후 직접 수정할 수 있습니다.

템플릿에서 사용 가능한 변수:

| 변수               | 설명                              |
| ------------------ | --------------------------------- |
| `{{identifier}}`   | 이슈 ID (예: `LIN-123`)          |
| `{{title}}`        | 이슈 제목                         |
| `{{description}}`  | 이슈 설명                         |
| `{{comments}}`     | 이슈 댓글 목록                    |

## 라이선스

MIT
