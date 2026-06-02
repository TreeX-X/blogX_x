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
Today, we're introducing a comprehensive upgrade to MiniMax Agent. We've given our upgraded Agent a new name: Mavis — MiniMax as a Jarvis, your AI assistant.

The following updates have been made:

Launch of Agent Teams.
MiniMax Agent desktop now supports multiple Agents working in parallel. You can create Agents with different roles, have them form teams to collaborate on tasks, which is suitable for long and complex tasks that a single Agent cannot handle.

TokenPlan and Agent Plan merged.
One subscription now connects CLI, API, and Agent, including all models like M2.7, music, video, and voice. Credits can be shared between Agent and API, offering more flexibility. If you previously subscribed to both Plans, you'll receive an additional month of membership.

MiniMax Agent Team Upgrade Banner

This time, we'd like to share our thinking behind creating Agent Teams: How did we design Agent teams? What problems do they solve? What costs did we incur? When should users use Agent Teams, and when is it unnecessary?

Let's first look at how current single Agents operate.

"Help me organize a long article about Agent Teams, with information based on the latest data from 2026, and deliver both Markdown and HTML versions."

In the past, we would give this instruction to a powerful AI assistant. It would immediately start responding, pushing a large block of text back into the chat window. This experience is smooth, but when the quality requirements for task delivery become higher, problems arise: Who researches the materials? Who verifies the facts? Who formats the document? If it's completed today, will the system remember the pitfalls encountered next time?

1. Why do we need Agent Teams

Although we can iterate on Skills to enable a single Agent to deliver excellent results in tasks, the delivery of results by one Agent inevitably means it is both the referee and the player. This contradiction is the starting point for building Agent Teams.

Agent Teams transform a complex task that was originally handled by a single Agent into a workflow with front-end and back-end processes, validation, and memory. The user still only sends one message, but the underlying Agent Team system determines whether splitting is needed, which roles can work in parallel, which results must be verified, and which experiences should be retained.

Let's continue with our scenario.

"Help me organize a long article about Agent Teams, with information based on the latest data from 2026, and deliver both Markdown and HTML versions."

A single Agent might be able to complete this task successfully, like a colleague sitting next to the user. When the user asks "How can I polish this paragraph?", it can immediately revise it; "There's a formatting issue here", it immediately goes to check. But this exposes several problems: 1. If the user doesn't give instructions, the Agent will stop, requiring the user to constantly execute commands like "confirm" and "continue".

Single Agents stop at unexpected times for the user.

Users often encounter situations where the Agent needs to do 7 things, but after completing 3 revisions, it stops and reports, saying "I have completed revisions 1, 2, and 3, do you want me to continue with the remaining 5 revisions".

This is because models generally suffer from context anxiety, and training for ultra-long tasks requires significant investment in money, time, and algorithm optimization. The model's judgment of when a task can be stopped is ambiguous.

Single Agents become less capable over time, with significant degradation in long tasks.

Users often feel that as the Agent executes, it transforms from "a smart assistant" to "I'm leading someone who is busy but easily distracted". Users keep asking: Do you still remember that requirement from earlier? Why did you turn the research task into product marketing again?

As long as one step goes off track, the subsequent content continues to be generated along that deviation.

Even more troublesome is that it's difficult for single Agents to naturally form "checks and balances". It may sincerely self-inspect, but what it examines is still the scene it just constructed.

Single agents also cannot quickly respond to long-cycle tasks.

Especially in IM scenarios (scenarios where agents are controlled through communication software), users have very little patience. When a user sends a message from IM, they expect a response within seconds. Even for complex tasks, users hope to first receive a reply like: "I understand, here's what I'll do, and I'll come back to you when it's complete." They don't want to stare at a dialog box for ten minutes, half an hour, or even longer just to confirm if the task has started. "Why isn't my Agent replying to me?" is the most frequent user feedback we receive.

Agent Teams, however, can provide a different experience. The main Agent first responds quickly to the user: acknowledging the task, confirming the objectives, and explaining that it will be split and executed in the background. The task is divided into multiple chapter packages or versions, executed in parallel.

Users don't need to wait for each sub-step to complete; they can receive updates at key nodes: task started, encountered a blockage, requires a decision, completed.

Users can also chat with the main Agent at any time: "I just had another idea, could you help me research it as well?" The main Agent can respond immediately: "Sure, I'll start another group of Agents to research this and report any new progress. At the same time, let me update you on the tasks already in progress: 2/5 are completed, among the remaining 3 tasks, 2 have entered the verification stage, and I will continue to monitor the third task."

Just like a thoughtful friend who can reply to WeChat messages instantly.

Moving beyond a specific task, we naturally need to accept the diversity of user needs and the division of roles across different domains.

A user might request an Agent to write code, research information, create PowerPoint presentations, organize meeting minutes, read PDFs, process spreadsheets, handle expense reports, plan projects, and generate weekly reports all in the same day. Each type of task has different input structures, tool permissions, quality standards, risk levels, and delivery formats.

A single Agent can temporarily play different roles through Skills, but role-playing is not the same as role division. True division of labor includes at least four dimensions from a contextual perspective: different tools, different contexts, different memories, and different Skills. In terms of results, output protocols and acceptance criteria also differ. Assuming we have already built an Agent Team system as described above, Agents with different responsibilities can more frequently encounter tasks in their own domains, turn encountered obstacles into memories, and form valuable actions into Skills. Like a group of colleagues who have long-term collaboration with the user, they continuously improve in their respective functions.

2. Current Multi-Agent Collaboration Practices in the Industry

Product / Engine How Multiple Agents Collaborate Advantages Limitations

OpenAI Agents SDK: One Agent can hand off a task to another Agent for continued processing, or temporarily call another Agent to obtain professional results before completing the task itself. The system is responsible for saving the conversation process, checking if input and output are compliant, and recording the execution process.

Clear collaboration method, suitable for assigning tasks to different specialized Agents;
Built-in security checks and process recording, facilitating productization;
Suitable for customer service, business processes, and tool-calling scenarios.

Multiple Agents typically work in sequence, with limited natural parallel capabilities;
Agents run within the same framework, resulting in weaker isolation;
More suitable for intra-product collaboration, not for large-scale independent task execution.

LangGraph: Places multiple Agents into a clear process, with each Agent responsible for one step. A supervising Agent can determine who to hand off to next, or complex tasks can be broken down into multi-layered teams. The system saves intermediate states, making it easy to pause, resume, and manually intervene.

Controllable processes, suitable for complex business operations;
Can express branches, loops, and multi-layered tasks;
Supports saving progress and resuming execution, suitable for long-process applications;
Delivery results are traceable and troubleshootable, suitable for cost reduction;

Higher setup and debugging costs;
Multiple Agents mainly collaborate within the same system, with weaker independent operation capabilities;
Complex processes require strong engineering design.

OpenCode

OpenCode itself is primarily a single-agent product, not focused on multiple agents collaborating with each other. Its core value lies in allowing different commands, skills, permissions, and sessions to follow the same execution path, making it suitable as underlying execution capability in external multi-agent systems.

Unified command system with fine-grained permission control, suitable for reliable coding agents;

Human and agent operations can reuse the same set of rules; suitable as an execution engine in larger systems.

Lacks a complete multi-agent team mechanism internally;

Does not handle division of labor, communication, acceptance, and scheduling among multiple agents;

External systems are needed to supplement team collaboration capabilities.

OMC / oh-my-claudecode — Team Pipeline

Multiple agents接力 in stages: first planning, then requirement organization, then execution, then verification. If verification fails, it enters a repair phase, after which it re-executes or re-verifies until completion or failure.

Complete process covering planning, requirements, execution, verification, and repair;

Can continue repairing after verification failures, not stopping at half-finished products;

Suitable for complex coding tasks.

The process is heavy, with high costs for simple tasks;

Depends on terminal environments and multiple background windows;

Stages are fixed, making it costly to temporarily adjust the plan.

Claude Code — Teams Mechanism

A Lead Agent creates a team and assigns tasks to multiple Teammates. Each Teammate has independent context, models, and permissions and can execute tasks separately. The Lead is responsible for dispatching tasks, checking status, sending messages, and closing members, while Teammates report back status upon completion.

Deeply integrated with Claude Code for a seamless user experience;

Context isolation between members, suitable for division of labor among multiple people;

Supports task management, messaging, idle notifications, and closure confirmation, providing relatively complete team collaboration capabilities.

Task scheduling mainly relies on the Lead Agent's own judgment, with stability affected by the model;

Complex dependencies are not clearly defined;

Some operational methods depend on terminal windows, with limited ability for long-running cross-session operations.

OMC Ralph Loop / Ralph Mode

Ralph is responsible for ensuring task progression. It typically works with parallel execution and verification processes: first, multiple execution units advance the task, then results are repeatedly checked; problems are continuously fixed until passing or reaching the limit.

Emphasizes completion quality, suitable for tasks requiring repeated refinement;

Connects execution and verification, reducing situations where tasks "end halfway";

Suitable for complex development and repair tasks.

Running time and costs may be high;

If inspection standards are unclear, there may be repeated repairs with limited effectiveness;

Must set iteration limits, cost limits, and stop conditions.

OMC Autopilot + Ralph

Autopilot breaks down tasks into a complete workflow: first analyzing requirements and technical solutions, then formulating implementation plans, followed by execution, after which Ralph continuously supplements and repairs, finally entering construction, inspection, testing, and multi-angle verification.

Covers the complete process from requirement understanding to final verification;

Suitable for automatic advancement of complex tasks;

Ralph can continue to fix problems after execution, improving delivery quality.

The system workflow is long, suitable for complex tasks but not for lightweight modifications;

Each stage depends on the quality of the previous stage; misunderstandings earlier will affect later stages;

Clear acceptance criteria are needed, otherwise verification effectiveness will decline in later stages.

3. MiniMax Agent Team: Giving each agent higher freedom based on constrained multi-agent loops

MiniMax's Agent Team is a multi-agent system led by a main agent that breaks down complex tasks into multiple parallel tasks assigned to a group of agents for concurrent execution, featuring built-in adversarial quality gates. It is a deterministic code logic-driven agent loop. Inspired by Ralph-Loop and Harness concepts, we recognized that the context of large language models is valuable. By splitting tasks and categorizing responsibilities, we isolate the context of each stage, improving the overall quality of agent output.

Basic Collaboration Flow of Leader, Worker, and Verifier

To transform multi-Agent from concept to a usable product, a basic collaboration flow is needed. We simplify it into three roles: Leader, Worker, and Verifier.

The Leader is responsible for converting user goals into task structures.

The Worker is responsible for executing specific subtasks. Different Workers can have different tools, contexts, and output requirements. Some Workers handle information retrieval, while others perform code editing. The value of Workers lies in specialization: the clearer the role, the easier the Worker's output can be reused, compared, and checked.

The Verifier is responsible for transforming "completed" into "deliverable". It can check factual sources, coverage checklists, risk boundaries, and can also suggest modifications to the Worker's results. This reflects the design logic of Agent Teams: the WorkerAgent and VerifierAgent have an adversarial relationship. Both aim for their own execution to end, but the end of one triggers the start of the other. This is similar to the R&D and quality assurance departments in a company, which deliver high-quality results through multiple rounds of adversarial iterations without requiring the CEO (human user) to be involved in every detail.

Compared to Task tools that can only create tasks and receive results in a single exchange, the Agent Team is a team that can interact at any time.

Traditional Task tools usually operate at the model tool invocation layer: the main Agent calls a task, dispatch, or spawn type tool, passes in a prompt, and waits for the sub-Agent to return text or a summary. This mechanism is suitable for short-lived, low-risk, locally exploratory tasks, such as having another model quickly search files, summarize materials, check an idea, or generate candidate answers. Although there are currently SubAgents running in the background, the communication between Agents is essentially still a single input-output, unable to support multi-round dialogues or real-time reporting of issues and conflicts.

To ensure the stable operation of the Team, we chose a reliable state machine to manage the execution cycle of each Agent. One execution cycle is a Session, and this state machine is the Team Engine. The Team Engine manages each task according to producing, verifying, and done phases. When verification fails, the Team Engine reactivates the producing node to continue modifications. During this process, the Leader receives status updates from the Team Engine and can actively confirm specific task details, or even send supplementary prompts to the currently running producing and verifying Agents. The collaborative relationship is no longer limited to a single function call but becomes a multi-round interaction with active push and on-demand queries.

Each run of the Agent Team has long-term value. The experience from this execution can be precipitated as memory and skills, enabling each specific Agent to better understand how to collaborate with users and complete tasks efficiently, while also helping all Agents better understand the user.

Inter-Agent Communication Design: Agents with Equal Rights to Humans

When designing and considering how Agents should collaborate, the most direct approach is to think about how humans and Agents work together. Users can perform operations like prompt, spawn, abort, and kill on Agents through frontend interactions, which means Agents themselves should also have the ability to perform these actions on other Agents. We abstract the operations that users can perform on Agents into interfaces, so the channels that actually operate these Agents can be users, other Agents, or the Agent Team's engine.

Of course, this design must maintain boundaries: equal rights do not mean that Agents have unlimited permissions, nor does it mean that humans are removed from the responsibility chain. On the contrary, only when Agents and humans share the same auditable collaboration surface can permissions, responsibilities, and risks be more easily seen.

3.1. Core Scenario One: Integration with IM for Asynchronous Execution with Quick Response

The interaction constraints of IM are quite special. When users send messages, they expect second-level feedback; however, many tasks naturally require minute-level or even hour-level execution: researching materials, organizing meeting minutes, generating PPTs, running code tests. If the system makes users wait for the final result, the experience becomes "the Agent has disappeared in the chat box".

Single Agents here easily fall into a dilemma: either provide only a shallow answer for quick replies, or let users wait without feedback for a long time to complete the task. Worse yet, IM conversations continue to happen. Users may add requirements midway, switch topics, or ask another question. If long tasks are bound to the same context as the current conversation, the system finds it difficult to maintain response speed while ensuring background tasks are not contaminated by new messages.

This echoes the design principles for long-running tasks, status updates, and human-in-the-loop in the official Google A2A protocol. The official blog of Anthropic Managed Agents proposes that "session does not equal model context window", and long tasks require a recoverable session log as an external context object.

This shows that industry consensus is forming: the underlying logic of asynchronous execution in IM: when tasks span multiple rounds of messages, multiple tools, and multiple Agents, they cannot rely on the current context of a certain model never being lost. The system needs to save task status, event logs, file artifacts, and decision records as recoverable objects. Agent collaboration is a stateful long-term task.

IM asynchronous execution scenarios

3.2. Core Scenario Two: Coding Harness

The AgentTeam project was greatly inspired and motivated by Harness concepts. Harness emphasizes going beyond basic code writing: Agents not only need to write code but also follow the entire development process, with code branching, sandbox execution, diff for modifications, rerunnable tests, recorded reviews, replayable failures, and the ability to split tasks among different roles when necessary. It binds the stopping conditions for Agent execution to observable external systems.

Division of labor among developer / tester / reviewer in Coding tasks

An industrial-grade Coding Harness includes at least four roles.

The Leader is the control plane. It first determines whether the task is worth starting a Team for: fixing typos or replacing constants might be cheaper with a single Agent or script; cross-file understanding and multi-scheme parallel comparison are more suitable for Teams. It also decides on decomposition granularity: whether to read code first, explore solutions in parallel, write reproduction tests first, retry several times after failure, and when to escalate to humans.

The Developer is responsible for implementation, with a clear work objective: requirements, related files, project constraints, and prohibitions. Its output is not just natural language explanations, but also includes modification rationale, potential risks, and verification suggestions.

The Tester is responsible for transforming "looks runnable" into "has external evidence". It needs to find existing test entry points, compress failure logs, and supplement minimal reproduction when necessary. The key is tool-grounded: verification results come from commands, tests, or executable checks.

The Reviewer is not the same as the Tester. Tests answer "does it pass known verifications", while Review is more concerned with "should it be changed this way". It checks abstract boundaries, compatibility, error handling, dependency introduction, permission expansion, and whether logs expose sensitive information. Reviewers can also be divided and work in parallel: regular reviewers focus on maintainability, security reviewers focus on input/credentials/network boundaries, and domain reviewers focus on business semantics.

How to integrate automated testing, code review, and manual acceptance

The first layer is automated testing and static checks. Harness treats test, lint, build, and format check as first-class citizens. After the Developer makes changes, the Tester executes verification; upon failure, the Leader decides whether to have the Developer fix it, have the Tester supplement logs, or report environmental issues.

The second layer is code review. The Reviewer Agent can first conduct an automatic preliminary review to proactively identify issues such as unused variables, missing exception branches, public API violations, dangerous shell calls, secret logs, and out-of-bounds file modifications.

3.3. Core Scenario Three: Parallel Information Retrieval and Research

A single Agent may encounter issues such as slow research speed, context pollution or dangerous injection, loss of the chain of evidence in the context, and biased research directions. The value of an Agent Team is to break down the research process into parallel information channels, then merge them into structured conclusions through a verifier and synthesizer. The focus is on designing a trustworthy research pipeline that ensures high research efficiency while breaking away from the single Agent's research approach, collecting and verifying information from different angles and both positive and negative perspectives.

How Independent Verifiers Reduce Citation Errors and Factual Hallucinations

The verifier first checks source verifiability. Formal sources should use stable URLs whenever possible: official pages, conference pages, author blogs. Search caches and aggregation pages can only serve as clues and cannot support formal conclusions. The verifier also checks whether the source status is outdated and whether there is contrary evidence denying its authenticity.

Parallel Information Retrieval and Research

3.4. Core Scenario Four: Pipeline-style Office Document Writing

When a single Agent creates documents, the most common misconception is: if the model can write, it can deliver. When a user says "help me create a report/Excel/PDF," a single Agent often generates a large block of text first, then attempts one-time typesetting, format checking, and error correction. Short documents can still be completed in a single context; but once the task becomes a long report, formal contract, or financial spreadsheet, problems quickly emerge: content planning, reference citation, structural consistency, chart and diagram objects, headers and footers, and export quality—all are crammed into the same context and execution loop.

AgentTeam bridges the gap from "can produce" to "can deliver"

Multi-Agent collaboration breaks down document delivery into multiple verifiable stages. The Planner first defines document goals and structure; the Writer is responsible for the main content; the Formatter handles layout and file objects; the Evaluator independently checks content, formatting, and file integrity. This division transforms "document generation" from a one-time text generation process into something similar to a CI/CD build pipeline: each step produces intermediate products, each step has checks, and each failure can be retried locally.

Pipeline-style Office Document Writing

4. Challenges and Considerations in the Development Process

Context Costs from Team Collaboration

When a group of Agents collaborate, a new type of cost emerges: handover costs, sharing and aggregation costs. These are not costs that can be solved by simply making the model's Context Window larger.

Handover cost refers to the need to reorganize the same piece of information between different Agents. After collecting dozens of web pages, the research Agent hands them over to the writing Agent. The writing Agent needs a document that has undergone preliminary research. Similarly, the writing Agent needs to hand its results to the formatting check Agent. Our current approach transforms handover materials into: 1. readable handover files 2. shared message board files for multiple Agents; Workers use file paths plus summaries for uninterrupted slow communication, avoiding cramming everything into the context at once.

Shared cost refers to the price of "letting all Agents see all information." Each additional piece of shared content requires tokens from every Worker in every round. When an Agent encounters problems during execution, it should write memories properly to ensure broadcasting to the contexts of all running/pending Agents. We use three methods to maintain this type of shared information:

1. Memory within an Agent - an experience of one Agent, subsequent executions of the same Agent will receive prompts, and even Agents currently running will be notified immediately.
2. Inter-Agent communication CLI - Agents have the ability to directly communicate with other running nodes for interruptive communication.
3. The whiteboard capability mentioned above - compared to the active notification in methods 1 and 2, the whiteboard can support storing much larger amounts of information, and other Agents can retrieve it more elegantly on demand.

Aggregation cost refers to the workload required to synthesize results from multiple Workers into a single deliverable. It's easy to collect 10 versions of materials in parallel, but it's difficult to synthesize them into one article that is factually consistent, has proper citations, and has a unified style. What the Leader needs to do at this step is often "to combine 10 into 1" rather than "adding more people to supplement." Acknowledging that this is expensive is the first step in designing a Team.

Balance between Time/Token Consumption and Result ROI

Multi-Agents have been difficult to equate with high ROI in past research. The paper "Cost of Consensus" claims that in specific models and homogeneous debate settings, consumption can reach 2.1-3.4 times the tokens of isolated self-correction, without improvement in accuracy or even worse. This conclusion points to a clear fact: unstructured "multi" without stopping conditions just spreads uncertainty in parallel, and simple AI chatrooms can hardly guarantee the quality of the final result.

ROI also includes user waiting time. Although we have already made long tasks asynchronous and allow users to communicate with the Leader Agent at any time to reduce immediate communication needs, the overall delivery time for tasks is still longer compared to a single Agent completing the task in one go. An Agent Team inevitably needs to execute steps 1-2-3-4 in sequence. We have thought a lot about how to control reasonable splitting granularity and balance the problems of poor performance on large tasks and slow delivery on overly fine-grained tasks. We believe that as the intelligence level of models improves, running Teams in the background and proactively reporting completion replaces the psychological cost of "watching the Agent slowly generate in the same conversation." The value of multi-Agents appears here together with the cost: users are willing to wait longer for verifiable, recoverable, and auditable results, provided the process is transparent.

Furthermore, we believe that when users see the high-quality results completed by Agent Teams, their trust in Agents increases. This allows them to free their minds for deeper and broader thinking, becoming more human-like thinkers, while leaving the task of implementing ideas and delivering results to Agent Teams.

Cost of Verifier, Retries, and Leader Decisions

The Verifier is key for moving a Team from demonstration to delivery.

The first type of cost is verification itself. A code task needs to run tests; a research task needs to verify sources and confirm citation boundaries. The more thorough the verification, the higher the consumption. If verification is just going through the motions, it only leaves a false sense of security of "appears to pass."

The second type of cost is the retry strategy. if Workers keep cycling through "make a small change - get rejected by verifier - make another small change," the entire plan becomes more expensive.

The third type of cost is that Leader decisions cannot be ambiguous. In the face of high-risk actions—whether to merge code or overwrite online data—the final judgment must have human approval. The official documentation of GitHub Copilot cloud agent keeps the entire process within GitHub: planning, commits, logs, and PRs can be reviewed by the team; the related changelog also mentions that security and quality analysis will be performed before PR finalization. It points to a clear direction: what the agent delivers is not just results, but also replayable and accountable traces.

Multi-agent systems are runtimes, not prompt orchestration

Leaving aside models and contexts, let's return to how our system is built: multi-agents are often simplified to "writing several prompts/skills to let models play different roles." In our actual code, this simplification is only the initial demo; the actual code complexity is hidden in many details, just to give users the smooth experience of "just having conversations is enough." Team Engine needs to manage various complex objects and state transformations to ensure that the Agent Team can run with sufficient automation and observability; the rendering layer needs to handle operations from multiple roles (human/agents/Team Engine) on the same concept: for example, creating a task requires handling multiple sources. The other complexity of rendering comes from the source of messages. In addition to user-agent conversations, there are also agent-to-agent conversations, scheduled task messages, Team Engine's scheduled monitoring, and user messages from IM, etc. The complex software engineering behind it is all so that users can browse carefully arranged information sources on a simple interface.

Industry materials are also pointing in the same direction. The official documentation of OpenAI Agents SDK emphasizes sandbox, workspace, handoff, and tracing; AWS AgentCore's official release lists Runtime, Memory, Identity, Gateway, Browser, etc., as enterprise-level modules. They all hint at one thing: the focus of Agent products is shifting from "writing prompts" to "maintaining the control plane."

Acknowledging that Agent Teams are runtimes will change product judgments. New features cannot rely solely on prompt fixes; events and observability need to be added to the runtime; constraints on permissions, runtime, and writing memory cannot rely solely on Agent self-discipline; appropriate soft and hard gates and interception must be enforced; maintaining multi-agents as runtimes is much heavier than maintaining them as prompt templates, but only this way can services be stable for real work.

5. Insights

5.1 Multi-agents for more reliable completion of complex tasks

The core of multi-agents is structure. Multi-agents without structure are just more expensive concurrency; multi-agents with structure are a delegatable, parallelizable, and verifiable execution system.

Therefore, to judge whether a multi-agent product is valuable, we should not look at how many agents it can start simultaneously, but whether it can answer several questions: why split, how to verify, when to stop, how to recover from failure, and how to manage memory. The clearer these questions are answered, the more the multi-agent resembles a production system; the less clear the answers, the more it resembles a group chat in a demo.

5.2 The value of a Team depends on complexity, but ROI should not only consider short-term gains.

Teams are optional. The more complex the task, the longer the chain, the higher the risk, and the more reusable the experience, the more likely the benefits of a Team will outweigh the costs; the shorter the task, the lower the risk, the more certain it is, the more likely a single agent or traditional automation will be better. Users should not be encouraged to "start a Team for everything," but rather helped to judge when collaboration is worthwhile and when simplicity should be maintained.

Whether choosing Team execution or direct execution by a single Agent, it's necessary to enable long-term progress for Agents through means like memory and Skills. Even though Teams use more Tokens and time, they ensure that Agents gain more experience and memory. In the long term, the growth of each Agent that better understands users and becomes more skilled should be considered as part of the ROI. Because when we believe an Agent has sufficient memory and Skills, the Team model should be the execution mode that most liberates humans from manual tasks.

5.3 Future Agents will be more like long-collaborating digital teams

Following the design mentioned in the "Inter-Agent Communication Design: Agents with Equal Rights to Humans" section, future Agent products will provide completely equal control interfaces and data flow for both humans and Agents. Humans will increasingly use management panels to configure Agent roles, capabilities, boundaries, and assign tasks, while making key decisions at critical nodes. This panel can also be controlled by an Agent. The overall operational logic may be closer to the inefficient AI chat room mentioned earlier. Whether AI can be completely entrusted with management and scheduling, making the management panel/Team Engine increasingly lightweight, still requires the emergence of more powerful models.

The multi-Agent approach is designed to transition AI from a "single-use tool" to a "long-term partner", and represents a crucial step in shifting from personal efficiency improvement to liberating humans from specific development tasks.

6. Open Source and How to Use

Our latest MiniMax Agent will be open-sourced in the near future. Due to the significant workload and rapid internal iterations, it is expected to be released together with the MiniMax M3 model.

Before open-sourcing, our desktop application has now been officially released. You are welcome to try downloading and experiencing it: https://agent.minimaxi.com/download. Currently, all you need is a MiniMax subscription to enjoy both Agent and TokenPlan products.
