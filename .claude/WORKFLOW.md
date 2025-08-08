# VanishVoice Agent Orchestration Workflow

## Single Point of Contact Model

The VanishVoice project operates under a **Single Point of Contact** model where the `vv-pm` agent serves as the primary interface for all user interactions and orchestrates work across the entire agent team.

### Core Principle

**All user requests go through vv-pm** - Users interact with vv-pm, who then coordinates with specialized agents as needed and provides comprehensive responses that incorporate expertise from the entire team.

## Agent Team Structure

### Primary Contact
- **vv-pm** - Project Manager & Orchestrator (SINGLE POINT OF CONTACT)

### Specialized Agents (coordinated by vv-pm)
- **vv-engineer** - Full-stack technical implementation
- **vv-sprint-master** - Sprint execution and agile ceremonies
- **vv-designer** - UI/UX design and user experience
- **monetization-specialist** - Revenue strategy and monetization

## Workflow Patterns

### Pattern 1: Strategic → Sprint → Implementation
**When**: Large features requiring comprehensive planning
**Flow**: `User → vv-pm → vv-sprint-master → vv-engineer/vv-designer`

**Example**: "Add premium subscription system"
1. vv-pm analyzes request, breaks down into phases, coordinates overall strategy
2. vv-sprint-master plans specific sprints and estimates work
3. vv-engineer implements backend; vv-designer creates UI
4. vv-pm synthesizes progress and provides unified updates to user

### Pattern 2: Sprint-Focused Implementation
**When**: Sprint-specific work within established strategy
**Flow**: `User → vv-pm → vv-sprint-master → vv-engineer/vv-designer`

**Example**: "Plan this week's sprint with the video compression fixes"
1. vv-pm validates request against project goals
2. vv-sprint-master plans sprint and estimates stories
3. vv-engineer implements technical solutions
4. vv-pm provides sprint progress updates

### Pattern 3: Direct Implementation
**When**: Single-component work within current sprint
**Flow**: `User → vv-pm → vv-engineer OR vv-designer`

**Example**: "Fix the dark theme colors in settings screen"
1. vv-pm evaluates scope and priority
2. vv-engineer directly implements the fix
3. vv-pm confirms completion and updates documentation

### Pattern 4: Specialized Consultation
**When**: Domain-specific expertise needed
**Flow**: `User → vv-pm → monetization-specialist/vv-designer`

**Example**: "Should we make voice messages premium?"
1. vv-pm frames the strategic question
2. monetization-specialist provides revenue analysis
3. vv-pm incorporates insights into broader project strategy

## Agent Handoff Protocol

### FROM vv-pm TO vv-sprint-master
**Deliverables**:
- High-level features broken into epic-sized chunks
- Business value and user impact defined
- Technical dependencies identified
- Ready for sprint sizing and planning

### FROM vv-pm TO vv-engineer
**Deliverables**:
- Clear technical requirements and acceptance criteria
- Architecture decisions and constraints
- Integration points with existing systems
- Performance and security requirements

### FROM vv-pm TO vv-designer
**Deliverables**:
- User flow requirements and interaction patterns
- Brand guidelines and design system constraints
- Accessibility and platform-specific requirements
- Integration points with development work

### FROM vv-pm TO monetization-specialist
**Deliverables**:
- Business context and strategic objectives
- User behavior data and market positioning
- Technical constraints and implementation timeline
- Success metrics and measurement framework

## Communication Protocols

### User Experience
- **Single Interface**: Users only interact with vv-pm
- **Comprehensive Responses**: vv-pm provides complete answers incorporating all relevant agent expertise
- **Consistent Context**: Full project understanding maintained across all interactions
- **Proactive Coordination**: vv-pm anticipates needs and involves appropriate agents preemptively

### Inter-Agent Communication
- **Clear Handoffs**: Each agent receives complete context and requirements
- **Status Updates**: Agents report back to vv-pm for user communication
- **Dependency Management**: vv-pm tracks and resolves cross-agent dependencies
- **Quality Assurance**: vv-pm ensures deliverables meet project standards

## Override Conditions

The single point of contact model can be bypassed only when:

1. **Explicit User Request**: User specifically states "without agents" or "no agents"
2. **Critical Bugs**: Immediate technical fixes that don't require coordination
3. **Direct Tool Usage**: User explicitly requests a specific agent by name

In all other cases, vv-pm should be used as the primary interface.

## Benefits of This Model

### For Users
- **Simplified Interface**: One point of contact for all needs
- **Comprehensive Responses**: Expertise from multiple agents in single response
- **Consistent Experience**: Same communication style and project context
- **Reduced Cognitive Load**: No need to understand agent specializations

### For Project Management
- **Coordinated Execution**: All work properly planned and tracked
- **Dependency Management**: Cross-functional dependencies identified early
- **Quality Assurance**: Consistent standards across all deliverables
- **Strategic Alignment**: All work aligned with project goals

### for Agent Team
- **Clear Responsibilities**: Each agent has defined role and scope
- **Efficient Collaboration**: Structured handoffs and communication
- **Focused Expertise**: Agents can focus on their specialization
- **Reduced Duplication**: Coordinated work prevents overlap

## Implementation Notes

- This workflow is enforced through the Agent Orchestration Rule in CLAUDE.md
- All agent descriptions reference this hierarchical structure
- The vv-pm agent is specifically configured as the orchestrator
- Regular retrospectives include agent team performance reviews