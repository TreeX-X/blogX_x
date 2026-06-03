---
sourceUrl: 'https://www.minimaxi.com/blog/minimax-agent-team-long-running-1779893521'
title: 'MiniMax Agent Team: 为长程任务，持续进化而生'
date: 2026-04-27T00:00:00.000Z
description: >-
  MiniMax Agent Team 是一个由主 Agent 牵头，把复杂任务拆成多个可并行任务分配给一批 Agent 并发执行的多 Agent
  系统，自带对抗性的质量门禁，适合长程任务和复杂协作场景。
tags:
  - ai
  - agent
  - agent-team
  - minimax
originalAuthor: MiniMax Research
originalLang: zh
isDraft: false
---
Today we're introducing the overall upgrade of MiniMax Agent. We've given our upgraded Agent a new name: Mavis — MiniMax as a Jarvis, your AI assistant.

The following updates have been made:

- **Launch of Agent Teams.**MiniMax Agent desktop now supports multiple Agents working in parallel. You can create Agents with different roles, form them into teams to collaborate on tasks, which is suitable for long and complex tasks that a single Agent cannot handle.
- **Merger of TokenPlan and Agent Plan.**One subscription that fully integrates CLI, API, and Agent. All models including M2.7, music, video, and voice are included. Credits can be shared between Agent and API, providing more flexibility. If you previously subscribed to both plans, you will receive an additional month of membership

![MiniMax Agent Team Upgrade Banner](https://filecdn.minimax.chat/public/agent-team-hero-1779893281286.jpeg)

*MiniMax Agent Team Upgrade Banner*

This time, we want to share with you our thinking behind creating Agent Teams: How did we design Agent teams? What problems are they meant to solve? What costs did we incur? When should users use Agent Teams and when is it unnecessary?

Let's first look at how current single agents execute tasks.

> "Help me organize a long article about Agent Teams, with information based on the latest data from 2026, and deliver both Markdown and HTML versions."

In the past, we would give this instruction to a powerful AI assistant. It would immediately start responding, pushing a large block of text back into the chat window. This experience is smooth, but when the requirements for task delivery quality become higher, problems arise: Who will research the materials? Who will verify the facts? Who will format the document? If it's completed today, will the system remember the pitfalls encountered this time next time?

## 1. Why Have Agent Teams

Although we can iterate on Skills to enable a single agent to deliver excellent results in tasks, one agent completing the delivery means it is both the judge and the contestant. This contradiction is the starting point for building Agent Teams.

Agent Teams transform a complex task that was originally placed on a single agent into a working process with front-end and back-end components, verification, and memory. The user still only sends one message, but the underlying Agent Team system determines whether splitting is needed, which roles can work in parallel, which results must be verified, and which experiences should be retained.

Let's continue with our scenario.

> "Help me create a long article about Agent Teams, with information based on the latest data from 2026, and deliver both Markdown and HTML versions."

A single Agent might be able to complete this task smoothly, like a colleague sitting next to the user. When the user asks "How can I polish this paragraph?", it can revise it immediately; "There's a formatting issue here", it immediately checks. But this reveals several problems: 1. If the user doesn't give instructions, the Agent will stop, requiring the user to constantly issue commands like "confirm", "continue", etc.

- **A single Agent will stop at unexpected times. **

Users often encounter situations where the Agent needs to do 7 things, but after completing 3 modifications, it stops and starts reporting, saying "I have completed modifications 1, 2, and 3, do you want me to continue with the remaining 5 modifications".

This is because models generally suffer from context anxiety, and training for ultra-long tasks requires significant investment in money, time, and algorithm optimization. The model's judgment of when a task can be stopped is ambiguous.

![](https://filecdn.minimax.chat/public/agent-team-why-stop-l-1779893281287.jpeg)

![](https://filecdn.minimax.chat/public/agent-team-why-stop-r-1779893281288.jpeg)

**A single Agent will become increasingly unintelligent, with significant degradation in long-term tasks.**

Users often feel that as the Agent executes, it transforms from "a smart assistant" to "I'm working with someone who is busy but easily distracted." Users constantly ask: Do you still remember that requirement from earlier? Why did you turn the research task into product marketing again?**Once any single step goes off track, subsequent content continues to be generated along that deviation.**What's more troublesome is that a single Agent has difficulty naturally forming "mutual checks and balances." It may sincerely self-inspect, but what it's checking is still the scenario it just constructed itself.

![](https://filecdn.minimax.chat/public/agent-team-why-dumber-l-1779893281289.jpeg)

![](https://filecdn.minimax.chat/public/agent-team-why-dumber-r-1779893281290.jpeg)

- **A single Agent also cannot quickly respond to long-term tasks.**

Especially in IM scenarios (scenarios where agents are controlled through communication software), users have very little patience. When a user sends a message from IM, they expect a response within seconds. Even for complex tasks, users hope the other party will first reply: "I understand, here's what I'll do, and I'll get back to you when it's done." They don't want to stare at a dialog box for ten minutes, half an hour, or even longer just to confirm if the task has started.**"Why isn't my Agent replying to me" is the most frequent user feedback we receive.**

Agent Team, however, can provide a different experience. The main Agent first responds quickly to the user: acknowledging receipt of the task, confirming the objectives, and explaining that it will be split and executed in the background. The task is divided into multiple chapter packages or versions, executed in parallel.

Users don't need to wait for each sub-step to complete; they can receive updates at key milestones: task started, encountered a blockage, requires a decision, completed.

Users can also chat with the main Agent at any time: "I just had another idea, could you help me research it as well?" The main Agent can respond at any time: "Sure, I'll start another group of Agents to research this, and I'll report any new progress. At the same time, let me update you: among the tasks already in progress, 2/5 have been completed. Of the remaining 3 tasks, 2 have entered the verification stage, and I will continue to monitor the last one."

Just like a thoughtful friend who can reply to your WeChat messages instantly.

![](https://filecdn.minimax.chat/public/agent-team-im-cmp-l-1779893281291.jpeg)

![](https://filecdn.minimax.chat/public/agent-team-im-cmp-r-1779893281292.jpeg)

- Moving beyond a specific task, we naturally need to accept**the diversity of user needs and the division of roles across different domains**

A user might ask an Agent to write code, research information, create PowerPoint presentations, organize meeting minutes, read PDFs, process spreadsheets, handle expense reports, plan projects, and generate weekly reports all in the same day. Each type of task has different input structures, tool permissions, quality standards, risk levels, and delivery formats.

A single Agent can temporarily play different roles through Skills, but role-playing is not the same as role division. True division of roles includes at least four dimensions from a contextual perspective: different tools, different contexts, different memories, and different Skills. From a results perspective, the output protocols and acceptance criteria also differ. Assuming we have already constructed an Agent Team system as mentioned above, Agents with different responsibilities can more frequently engage with tasks in their respective domains, turning encountered challenges into memories and valuable actions into Skills. Like a group of colleagues who have long-term collaboration with users, they continuously improve in their respective functions.

![](https://filecdn.minimax.chat/public/agent-team-role-l-1779893281293.jpeg)

![](https://filecdn.minimax.chat/public/agent-team-role-r-1779893281294.jpeg)

## 2. Multi-Agent Collaboration Practices in the Current Industry

Product / Engine

How Multi-Agents Collaborate

Advantages

Limitations

OpenAI Agents SDK

One Agent can hand off tasks to another Agent for continued processing, or temporarily call another Agent to obtain professional results before continuing to complete the task itself. The system is responsible for saving the conversation process, checking if inputs and outputs are compliant, and recording the execution process.

Clear collaboration model, suitable for assigning tasks to different specialized Agents;

Built-in security checks and process logging, facilitating productization;

Suitable for scenarios like customer service, business processes, and tool invocation.

Multiple Agents typically work in sequence, with limited natural parallel capabilities;

Agents run within the same framework, resulting in weaker isolation;

More suitable for intra-product collaboration, not ideal for large-scale independent task execution.

LangGraph

Places multiple Agents into a clear workflow, with each Agent responsible for a specific step. A lead Agent can determine which Agent to handle the next step, or complex tasks can be broken down into multi-layer teams. The system saves intermediate states, making it easy to pause, resume, and allow for human intervention.

Controllable workflow, suitable for complex business scenarios;

Can express branches, loops, and multi-layered tasks;

Supports saving progress and resuming execution, suitable for long-running processes;

Delivery results are traceable and troubleshootable, suitable for cost reduction;

Higher setup and debugging costs;

Multiple Agents primarily collaborate within the same system, with weaker independent operation capabilities;

Complex workflows require strong engineering design.

OpenCode

OpenCode itself is primarily a single-Agent product, not focused on multiple Agents collaborating with each other. Its core value lies in allowing different commands, skills, permissions, and sessions to follow the same execution path, making it suitable as a bottom-level execution capability in external multi-Agent systems.

Unified command body system with fine-grained permission control, suitable for building reliable coding Agents;

Human operations and Agent operations can reuse the same set of rules; suitable as an execution engine within larger systems.

No complete multi-Agent team mechanism internally;

Does not handle division of labor, communication, acceptance, and scheduling of multiple Agents;

External systems are needed to supplement team collaboration capabilities.

OMC / oh-my-claudecode — Team Pipeline

Multiple Agents接力 in stages: first planning, then requirement organization, then execution, then verification. If verification fails, it enters a repair phase, after which it re-executes or re-verifies until completion or failure.

Complete process covering planning, requirements, execution, verification, and repair;

Can continue repairing after verification failures, won't stop at semi-finished products;

Suitable for complex coding tasks.

The process is heavy, with high costs for simple tasks;

Depends on terminal environments and multiple background windows;

Stages are fixed, with high costs for temporary adjustments to the plan.

Claude Code — Teams mechanism

A Lead Agent creates a team and assigns tasks to multiple Teammates. Each Teammate has independent context, models, and permissions, and can execute tasks separately. The Lead is responsible for dispatching tasks, viewing status, sending messages, and closing members, while Teammates report back status upon completion.

Deeply integrated with Claude Code, providing a seamless user experience;

Context isolation between members, suitable for division of labor among multiple people;

Supports task management, messaging, idle notifications, and closure confirmation, with relatively complete team collaboration capabilities.

Task scheduling mainly depends on the Lead Agent's own judgment, and stability is affected by the model;

Complex dependencies are not clearly defined;

Some running methods depend on terminal windows, with limited long-running capabilities across sessions.

OMC Ralph Loop / Ralph Mode

Ralph is responsible for ensuring tasks progress continuously. It typically works with parallel execution and verification processes: first, multiple execution units advance the task, then results are repeatedly checked; if problems are found, they continue to be fixed until they pass or reach the limit.

Emphasizes completion quality, suitable for tasks that require repeated refinement;

Can connect execution and verification, reducing the situation of tasks ending halfway through;

Suitable for complex development and repair-type tasks.

Running time and costs may be high;

If inspection standards are unclear, there may be repeated repairs with limited effectiveness;

Must set iteration limits, cost limits, and stopping conditions.

OMC Autopilot + Ralph

Autopilot breaks down tasks into a complete workflow: first analyzing requirements and technical solutions, then creating implementation plans, followed by execution, after which Ralph continuously completes and fixes issues, and finally entering construction, inspection, testing, and multi-angle verification.

Covers the complete process from requirement understanding to final verification;

Suitable for automatically advancing complex tasks;

Ralph can continue to fix issues after execution, improving delivery quality.

The system workflow is longer, suitable for complex tasks but not for lightweight modifications;

Each stage depends on the quality of the previous stage; misunderstanding earlier stages affects subsequent ones;

Clear acceptance criteria are needed; otherwise, later verification effectiveness will decrease.

## 3. MiniMax Agent Team: Based on constrained multi-agent cycles, giving each agent higher freedom

MiniMax's Agent Team is a multi-agent system led by a main Agent that breaks down complex tasks into parallel subtasks assigned to multiple Agents for concurrent execution, with built-in adversarial quality gates. It's a deterministic code logic-driven Agent loop. Inspired by Ralph-Loop and Harness, we recognized that the context of large models is valuable. By splitting tasks and classifying responsibilities, we isolate the Context for each stage, improving the overall quality of Agent output.

![](https://filecdn.minimax.chat/public/agent-team-team-overview-l-1779893281295.jpeg)

![](https://filecdn.minimax.chat/public/agent-team-team-overview-r-1779893281296.jpeg)

- **Basic collaboration flow of Leader, Worker, and Verifier**

To make multi-Agent a practical product from concept, a basic collaboration flow is needed. We've simplified it into three roles: Leader, Worker, and Verifier.

The Leader is responsible for converting user goals into task structures.

Worker is responsible for executing specific subtasks. Different Workers can have different tools, contexts, and output requirements. Some Workers handle information retrieval, while others perform code editing. The value of a Worker lies in specialization: the clearer the role, the easier the Worker's output can be reused, compared, and checked.

Verifier is responsible for transforming "completed" into "deliverable." It can verify factual sources, check coverage lists, assess risk boundaries, and suggest modifications to the Worker's results. This reflects the design logic of Agent Team: WorkerAgent and VerifierAgent have an adversarial relationship. Both aim to complete their execution, but the completion of one triggers the start of the other. This is similar to the research and development and quality assurance departments in a company, which deliver high-quality results through multiple rounds of adversarial iterations without requiring detailed intervention from the CEO (the human user).

![](https://filecdn.minimax.chat/public/agent-team-lwv-l-1779893281297.jpeg)

![](https://filecdn.minimax.chat/public/agent-team-lwv-r-1779893281298.jpeg)

- Compared to Task tools that can only create tasks and retrieve results in a single exchange,**Agent Team is a team that can interact at any time.**

Traditional Task tools typically occur at the model tool invocation layer: the main Agent calls a task, dispatch, or spawn type tool, passes in a prompt, and waits for the sub-Agent to return a text or summary. This type of mechanism is suitable for short-lifecycle, low-risk, locally exploratory tasks, such as having another model quickly search files, summarize materials, check an idea, or generate candidate answers. Although there are currently SubAgents running in the background, the communication between Agents is essentially still one-time input-output, without multi-round dialogue or real-time reporting of encountered problems and contradictions.

To ensure the stable operation of Team, we chose a reliable state machine to manage the lifecycle of each Agent, where a lifecycle is a Session, and this state machine is the Team Engine. Team Engine manages each task according to producing, verifying, and done states. When verification fails, Team Engine will re-activate the producing node to continue modifications. During this process, the Leader will receive the latest status reports from Team Engine and can also confirm specific task details, and can even send supplementary prompts to the producing and verifying Agents that are currently running. The collaborative relationship is no longer limited to a single function call, but becomes a multi-round interaction with active push and on-demand querying.

Each run of an Agent Team has long-term value. The experience from this execution can also be `precipitated (沉淀)` as memory and Skill, allowing each specific Agent to more proactively understand how to collaborate with users and complete tasks efficiently, and also supporting all Agents to better understand users.

![](https://filecdn.minimax.chat/public/agent-team-engine-l-1779893281299.jpeg)

![](https://filecdn.minimax.chat/public/agent-team-engine-r-1779893281300.jpeg)

- **Agent Communication Design: Agents Have Equal Rights to Humans**

When designing and considering how Agents should collaborate with each other, the most direct approach is to think about how humans and Agents work together. Users can perform operations such as prompt, spawn, abort, kill on Agents through frontend interactions, which means that Agents themselves should also have the ability to perform these actions on other Agents. We abstract the operations that users can perform on Agents into interfaces, so the actual channels for operating these Agents can be users, other Agents, or the AgentTeam's engine.

![](https://filecdn.minimax.chat/public/agent-team-comm-l-1779893281301.jpeg)

![](https://filecdn.minimax.chat/public/agent-team-comm-r-1779893281302.jpeg)

Of course, this design must maintain boundaries: equality does not mean that Agents gain unlimited permissions, nor does it mean that humans exit the chain of responsibility. On the contrary, only when Agents and humans share the same auditable collaboration surface can permissions, responsibilities, and risks be more easily seen.

### 3.1. Core Scenario 1: Connecting to IM, Asynchronous Execution for Quick Response

The interaction constraints of IM are quite special. When users send messages, they expect second-level feedback; but many tasks naturally require minute-level or even hour-level execution: researching materials, organizing meeting minutes, generating PPTs, running code tests. If the system makes users wait for the final result, the experience becomes "the Agent disappears in the chat box".

A single Agent here can easily fall into a dilemma: either provide only a shallow answer for quick replies, or let users wait without feedback for a long time to complete the task. What's worse, IM conversations continue to happen. Users may add requirements midway, switch topics, or ask another question. If long tasks are bound to the same context as the current conversation, the system finds it difficult to maintain response speed and to ensure that background tasks are not contaminated by new messages.

This echoes the design principles for long-running tasks, status updates, and human-in-the-loop in Google's official A2A protocol. The official Anthropic Managed Agents blog states that "a session is not equal to the model's context window," and that long tasks require a recoverable session log as an external context object.

This indicates that industry consensus is forming: The underlying logic of IM asynchronous execution: When tasks span multiple rounds of messages, multiple tools, and multiple Agents, you cannot rely on a model's current context never being lost. The system needs to save task status, event logs, file artifacts, and decision records as recoverable objects. Agent collaboration is a stateful long-term task.

![IM asynchronous execution scenario](https://filecdn.minimax.chat/public/agent-team-core-im-1779893281303.jpeg)

*IM asynchronous execution scenario*

### 3.2. Core Scenario Two: Coding Harness

The AgentTeam project was greatly inspired and motivated by Harness concepts. Harness emphasizes going beyond basic code writing: Agents not only need to write code but also follow the entire development process. Code should have branches, execution should have sandboxes, modifications should have diffs, tests should be rerunnable, reviews should have records, failures should be replayable, and when necessary, tasks can be divided among different roles. The stopping conditions for Agent execution should be bound to deterministic and observable external systems.

- **Division of labor among developer / tester / reviewer in Coding tasks**

An industrial-grade Coding Harness should include at least four types of roles.

Leader is the control plane, it first determines whether a task is worth starting a Team: fixing typos or replacing constants might be cheaper with a single Agent or script; cross-file understanding and multi-solution parallel comparison are more suitable for Team. It also needs to decide on the granularity of decomposition: whether to read code first, whether to explore solutions in parallel, whether to write reproduction tests first, how many times to retry after failure, and when to escalate to humans.

Developer is responsible for implementation, it has a clear work goal: requirements, related files, project constraints and prohibitions. Its output is not just natural language explanations, but also includes modification rationale, potential risks, and verification suggestions.

Tester is responsible for turning "looks runnable" into "has external evidence". It needs to find existing test entry points, compress failure logs, and supplement with minimal reproduction when necessary. The key is tool-grounded: verification results come from commands, tests, or executable checks.

Reviewer is not the same as Tester. Testing answers "does it pass known verification", while Review is more concerned with "should it be changed this way". It needs to check abstract boundaries, compatibility, error handling, dependency introduction, permission expansion, and whether logs expose sensitive information. Reviewers can also be divided and work concurrently: regular reviewers look at maintainability, security reviewers look at input/credentials/network boundaries, and domain reviewers look at business semantics.

- **How to integrate automated testing, code review, and manual acceptance**

The first layer is automated testing and static checking. Harness treats test, lint, build, and format check as first-class citizens. After a Developer makes changes, the Tester performs verification; when it fails, the Leader decides whether to have the Developer fix it, have the Tester add logs, or report environment issues.

The second layer is code review. Reviewer Agent can first perform an automatic preliminary review to detect unused variables, missing exception branches, public API violations, dangerous shell calls, secret logging, and out-of-bounds file modifications.

### 3.3. Core Scenario Three: Parallel Information Retrieval and Research

A single Agent may encounter issues such as slow research speed, contaminated or dangerous injection of context, evidence chains getting lost in the context, and biased research directions. The value of an Agent Team is to break down the research process into parallel information channels, then merge them into structured conclusions through verifier and synthesizer. The focus is on designing a trustworthy research pipeline that ensures high research efficiency while allowing escape from the single-Agent's research approach, collecting and confirming information from different angles and both positive and negative perspectives.

- **How independent verifiers reduce citation errors and factual hallucinations**

The verifier first checks the verifiability of sources. Formal sources should use stable URLs whenever possible: official pages, conference pages, author blogs. Search caches and aggregation pages can only serve as clues and cannot support formal conclusions. The verifier also checks whether sources are outdated and whether there is contrary evidence denying their authenticity.

![Parallel Information Retrieval and Research](https://filecdn.minimax.chat/public/agent-team-core-research-1779893281304.jpeg)

*Parallel Information Retrieval and Research*

### 3.4. Core Scenario Four: Pipeline-style Office Document Writing

When a single Agent creates documents, the most common misconception is that if the model can write, it can deliver. When users say "help me create a report/Excel/PDF", a single Agent often generates a large block of text first, then attempts to format, check formatting, and fix errors all at once. Short documents can still be completed within a single context; but once the task becomes a long report, formal contract, or financial spreadsheet, problems quickly emerge: content planning, reference materials, structural consistency, chart objects, headers and footers, and export quality all get crowded into the same context and execution cycle.

- **AgentTeam bridges the gap from "can produce" to "can deliver"**

Multi-Agent collaboration breaks down document delivery into multiple verifiable stages. Planner first defines document goals and structure; Writer is responsible for the main content; Formatter handles layout and file objects; Evaluator independently checks content, formatting, and file integrity. This division transforms "document generation" from one-time text generation into something similar to a CI/CD pipeline: each step produces intermediate artifacts, each step has checks, and each failure can be retried locally.

![Pipeline-style office document writing](https://filecdn.minimax.chat/public/agent-team-core-docwriting-1779893281305.jpeg)

*Pipeline-style office document writing*

## 4. Difficulties and reflections during the development process

- **Context costs brought by Team collaboration**

When a group of Agents collaborate, a new type of cost is exposed: handover costs, sharing costs, and aggregation costs. These are not costs that can be solved by "making the model's Context Window larger".

Handover cost refers to the need for the same information to be reorganized between different Agents. After researching dozens of web pages, the research Agent hands over to the writing Agent. The writing Agent needs a document that has undergone preliminary research. The writing Agent also needs to hand over the writing result to the format checking Agent. Our current approach is to convert the handover items into: 1. Readable handover files 2. Shared message board files for multiple Agents; Workers communicate through these files with paths and summaries without interruption, avoiding stuffing everything into the context at once.

Shared cost refers to the expense of "letting all Agents see all information." Each additional piece of shared content requires tokens from each Worker in every round. When an Agent encounters a problem during execution, it should write memories properly to ensure they are broadcast to the contexts of all running/pending Agents. We use three methods to maintain this type of shared information: 1. Memory within an Agent - this Agent's experience is shared with subsequent executions of the same Agent, and even running Agents are notified immediately. 2. Inter-Agent communication CLI - Agents can directly communicate with other running nodes for interruptive communication. 3. The whiteboard capability mentioned above - compared to the active notification in methods 1 and 2, the whiteboard can store larger amounts of information, and other Agents can retrieve it more elegantly on-demand.

Aggregation cost refers to the workload required to synthesize multiple Worker results into one deliverable. It's easy to collect 10 versions of materials in parallel, but difficult to synthesize them into one article that is factually consistent, properly cited, and stylistically uniform. The Leader's role here is often "to combine 10 into 1" rather than "adding more people to supplement." Acknowledging that this is expensive is the first step in designing a Team.

- **Balancing Time/Token Consumption with Result ROI**

Multi-Agent has rarely been equated with high ROI in past research. The paper "Cost of Consensus" claims that in specific models with homogeneous debate settings, consumption can reach 2.1-3.4 times the tokens of isolated self-correction, without improvement in accuracy or even worse results. This conclusion points to a clear fact: "multi" without structure or stopping conditions only spreads uncertainty in parallel, and simple AI chatrooms cannot guarantee the quality of final results.

ROI also includes user waiting time. Although we have asynchronousized long tasks, allowing users to communicate with the Leader Agent at any time to reduce immediate communication needs, the overall task delivery time has still increased. Compared to a single Agent completing tasks in one go, an Agent Team inevitably needs to execute steps 1-2-3-4 sequentially. We have spent considerable time thinking about how to control reasonable splitting granularity and balance the issues of poor performance in large tasks and slow delivery with overly fine-grained task splitting. We believe that as model intelligence improves, having Teams run in the background and proactively report upon completion replaces the psychological cost of "watching the Agent slowly generate in the same conversation." The value of Multi-Agent appears here alongside its cost: users are willing to wait longer for verifiable, recoverable, and auditable results, provided the process is transparent.**Furthermore, we believe that when users see the high-quality results completed by the Agent Team, their trust in Agents increases. They will free up their own thinking to engage in deeper and broader reflection, becoming more human-like thinkers, while delegating the tasks of executing ideas and delivering results to the Agent Team.**

- **Cost of Verifier, retries, and Leader decisions**

Verifier is the key for Team to move from demonstration to delivery.

The first type of cost is verification itself. A code task requires running tests; a research task requires checking sources and confirming citation boundaries; the more thorough the verification, the higher the cost; if verification is just a formality, it only leaves a false sense of security of "appears to pass".

The second type of cost is the retry strategy. If the Worker keeps looping in "make a change—rejected by verifier—make another change", the entire plan becomes more expensive.

The third type of cost is that Leader decisions cannot be ambiguous. In the face of high-risk actions—whether to merge code, whether to overwrite online data—the final judgment must be signed off by a human. The official documentation for GitHub Copilot cloud agent keeps the entire process within GitHub: plans, commits, logs, and PRs can be reviewed by the team; the related changelog also mentions that security and quality analysis will be conducted before the PR is finalized. It points out a clear direction: what the Agent delivers, in addition to results, is also a replayable and traceable track.

- **Multi-Agent systems are runtime, not prompt orchestration**

Leaving aside the models and context, let's return to how our system is built: Multi-Agent systems are often simplified to "writing several prompts/skills to let models play different roles". In our actual code, this simplification is merely the initial demo; the actual code complexity is hidden in many details, just to give users a smooth experience of "just having conversations". Team Engine needs to manage various complex objects and state transformations to ensure the Agent Team's operation is sufficiently automated and observable. At the rendering level, it needs to handle operations from multiple roles (human/Agent/Team Engine) on the same concept: for example, creating a task involves handling multiple sources. The complexity on the other side of rendering comes from message sources. Besides user-Agent conversations, there are also Agent-to-Agent conversations, scheduled task messages, Team Engine's scheduled monitoring, and user messages from IM platforms, etc. The complex software engineering behind it all is designed to allow users to browse carefully arranged information sources on a simple interface.

Industry materials are also pointing in the same direction. The official documentation for OpenAI Agents SDK emphasizes sandbox, workspace, handoff, tracing; AWS AgentCore's official release lists Runtime, Memory, Identity, Gateway, Browser, etc., as enterprise-level modules. They all point to one thing: the focus of Agent products is shifting from "writing prompts" to "maintaining the control plane".

Acknowledging that an Agent Team is a runtime changes product judgment. New features cannot rely solely on prompt fixes; events and observability must be added to the runtime. Permissions and runtime constraints, as well as constraints on writing memory, cannot depend solely on Agent self-discipline; appropriate soft and hard gates and intercepts must be enforced. Maintaining multi-Agent as a runtime is much heavier than maintaining it as a prompt template, but only this way can it stably serve real-world work.

## 5. Insights

### 5.1 Multi-Agent for More Reliable Completion of Complex Tasks

The core of multi-Agent is structure. A structureless multi-Agent is just more expensive concurrency; a structured multi-Agent is a delegatable, parallelizable, and verifiable execution system.

Therefore, to judge whether a multi-Agent product is valuable, we should not look at how many Agents it can start simultaneously, but rather whether it can answer several questions: Why split? How to verify? When to stop? How to recover from failure? How to manage memory? The clearer these questions are answered, the more the multi-Agent resembles a production system; if answered unclearly, it resembles more of a group chat in a demonstration.

### 5.2 The Value of Team Depends on Complexity, but ROI Cannot Only Consider Short Term

Team is just an option. The more complex the task, the longer the chain, the higher the risk, and the more reusable the experience, the more likely the Team's benefits will outweigh its costs; for shorter, lower-risk, and more certain tasks, a single Agent or traditional automation is likely more optimal. Users should not be encouraged to "always create a Team," but rather helped to determine when collaboration is worthwhile and when simplicity should be maintained.

Whether executing through Team or individual Agents, it's necessary to enable long-term progress for Agents through means like memory and Skill. Even if Teams use more Tokens and time, they should allow Agents to gain more experience and memory. In the long term, the growth of each Agent that better understands users and becomes more skilled should be considered as part of the ROI. Because when we believe that Agents have sufficient memory and Skill, the Team model should be the execution mode that most liberates humans from manual work.

### 5.3 Future Agents will be more like long-term collaborative digital teams

Following**Inter-Agent Communication Design: Agents with Equal Rights to Humans**, future Agent products will provide completely equal control interfaces and data flow for both humans and Agents. Humans will increasingly use management panels to configure Agent roles, capabilities, boundaries, and assign tasks, while making key decisions at critical nodes. This panel can also be controlled by an Agent. The overall operational logic may be closer to the inefficient AI chat room mentioned earlier. Whether AI can be fully entrusted with management and scheduling, making the management panel/Team Engine increasingly lightweight, still requires the emergence of more powerful models.

Multi-Agent systems are designed to move AI from being a "single-use tool" to a "long-term partner," representing a crucial step in transforming from personal efficiency improvement to liberating humans from specific development tasks.

## 6. Open Source and How to Use

Our latest MiniMax Agent will be open-sourced in the near future. Due to the large workload and rapid internal iterations, it is expected to be released together with the MiniMax M3 model.

Before open-sourcing, our desktop client has now been officially released, and we welcome you to try downloading it: https://agent.minimaxi.com/download. Currently, with just a MiniMax subscription, you can enjoy both Agent and TokenPlan products.
