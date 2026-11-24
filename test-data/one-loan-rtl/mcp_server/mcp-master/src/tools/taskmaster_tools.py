"""
Taskmaster related tools for MCP server
"""

import json
import os
import logging
import requests
from .base import BaseTool, sanitized_error
from typing import Any, Dict
from ..internal_service_auth import get_internal_service_auth_token

logger = logging.getLogger(__name__)

class CreateTaskTool(BaseTool):
    """ Tool for creating a task in Taskmaster """

    def __init__(self):
        super().__init__(
            name="create_task",
            description="Tool for creating a task in Taskmaster",
            input_schema={
                "type": "object",
                "properties": {
                    "loan-id": {
                        "type": "string", 
                        "description": "The ID of the loan to associate the task with"
                    },
                    "task-template-id": {
                        "type": "string", 
                        "description": "The ID of the task template to use for creating the task"
                    },
                    "task-title": {
                        "type": "string", 
                        "description": "The title of the task to be created"
                    },
                    "task-description": {
                        "type": "string", 
                        "description": "The description of the task to be created"
                    },
                    "task-type": {
                        "type": "string", 
                        "description": "The type of the task to be created"
                    },
                    "company": {
                        "type": "string", 
                        "description": "The company associated with the task"
                    }
                },
                "required": ["loan-id", "task-template-id", "company"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute task creation 
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: loan-id, task-template-id, company"}, indent=2)
        
        domain = os.getenv("TASKMASTER_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "Taskmaster domain not configured. Please set the TASKMASTER_DOMAIN environment variable."},
                indent=2
            )
        
        url = f"{domain}/v1/loans/{arguments['loan-id']}/task"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "x-gr-company": arguments["company"]
        }

        # Remove non-payload keys
        exclude_keys = {"loan-id", "company"}
        payload = {k: v for k, v in arguments.items() if k not in exclude_keys}

        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return json.dumps({"success": True, "data": response.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to create task", e, logger=logger)
        

class CreateTasksTool(BaseTool):
    """ Tool for creating tasks in Taskmaster, useful when you have multiple tasks to create and want to minimize API calls by batching them together """

    def __init__(self):
        super().__init__(
            name="create_tasks",
            description="Tool for creating a set of tasks in Taskmaster",
            input_schema={
                "type": "object",
                "properties": {
                    "loan-id": {
                        "type": "string",
                        "description": "The ID of the loan to associate the tasks with"
                    },
                    "company": {
                        "type": "string",
                        "description": "The company associated with the tasks"
                    },
                    "tasks": {
                        "type": "array",
                        "description": "List of tasks to create",
                        "items": {
                            "type": "object",
                            "properties": {
                                "task-template-id": {
                                    "type": "string",
                                    "description": "The ID of the task template to use"
                                },
                                "task-title": {
                                    "type": "string",
                                    "description": "The title of the task"
                                },
                                "task-description": {
                                    "type": "string",
                                    "description": "The description of the task"
                                },
                                "task-type": {
                                    "type": "string",
                                    "description": "The type of the task"
                                }
                            },
                            "required": ["task-template-id"]
                        }
                    },
                    "taskGroups": {
                        "type": "array",
                        "description": "Optional list of task groups. Tasks within a group can be linked together. Use this to organize related tasks and optionally enforce sequential completion.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {
                                    "type": "string",
                                    "description": "A descriptive name for the task group (e.g. 'underwriting-conditions', 'closing-checklist')"
                                },
                                "linkTasks": {
                                    "type": "boolean",
                                    "description": "When true, tasks within the group are linked together. Must be set to true to link the tasks in the group.",
                                    "default": True
                                },
                                "tasks": {
                                    "type": "array",
                                    "description": "List of tasks belonging to this group",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "task-template-id": {
                                                "type": "string",
                                                "description": "The ID of the task template to use"
                                            },
                                            "task-title": {
                                                "type": "string",
                                                "description": "The title of the task"
                                            },
                                            "task-description": {
                                                "type": "string",
                                                "description": "The description of the task"
                                            },
                                            "task-type": {
                                                "type": "string",
                                                "description": "The type of the task"
                                            }
                                        },
                                        "required": ["task-template-id"]
                                    }
                                }
                            },
                            "required": ["name", "linkTasks", "tasks"]
                        }
                    }
                },
                "required": ["loan-id", "company", "tasks"]
            }
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: loan-id, company, tasks"}, indent=2)

        domain = os.getenv("TASKMASTER_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "Taskmaster domain not configured. Please set the TASKMASTER_DOMAIN environment variable."},
                indent=2
            )

        url = f"{domain}/v2/loans/{arguments['loan-id']}/tasks"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "x-gr-company": arguments["company"]
        }

        payload: Dict[str, Any] = {"tasks": arguments["tasks"]}
        if "taskGroups" in arguments:
            payload["taskGroups"] = arguments["taskGroups"]

        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return json.dumps({"success": True, "data": response.json()}, indent=2)

        except requests.RequestException as e:
            result = json.loads(sanitized_error("Failed to create tasks", e, logger=logger))
            if e.response is not None and e.response.status_code == 500:
                result["error_code"] = "taskmaster_create_http_500"
            return json.dumps(result, indent=2)
        

class GetTaskTemplatesTool(BaseTool):
    """ Tool for fetching task templates from Taskmaster """

    def __init__(self):
        super().__init__(
            name="get_task_templates",
            description="Fetches task templates from Taskmaster",
            input_schema={}
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute fetching task templates
        domain = os.getenv("TASKMASTER_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "Taskmaster domain not configured. Please set the TASKMASTER_DOMAIN environment variable."},
                indent=2
            )
        
        url = f"{domain}/v1/mortgage/task-templates?active-only=false"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "x-gr-company": "gri"
        }

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return json.dumps({"success": True, "data": response.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to fetch task templates", e, logger=logger)


class GetTaskTool(BaseTool):
    """ Tool for fetching a specific task on a loan from Taskmaster """

    def __init__(self):
        super().__init__(
            name="get_task",
            description="Fetches a specific task on a loan from Taskmaster",
            input_schema={
                "type": "object",
                "properties": {
                    "loan-id": {
                        "type": "string", 
                        "description": "The ID of the loan for which to fetch the task"
                    },
                    "task-id": {
                        "type": "string", 
                        "description": "The ID of the task to fetch"
                    },
                    "company": {
                        "type": "string", 
                        "description": "The company associated with the loan"
                    }

                },
                "required": ["loan-id", "task-id", "company"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute task retrieval 
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: loan-id, task-id, company"}, indent=2)

        domain = os.getenv("TASKMASTER_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "Taskmaster domain not configured. Please set the TASKMASTER_DOMAIN environment variable."},
                indent=2
            )

        url = f"{domain}/v1/loans/{arguments['loan-id']}/tasks/{arguments['task-id']}?include-language-content=true&include-additional-details=true&include-documents=true&include-affirmation-responses=true&source=managed"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "x-gr-company": arguments["company"]
        }

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return json.dumps({"success": True, "data": response.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to fetch task", e, logger=logger)

class GetTasksTool(BaseTool):
    """ Tool for fetching all borrower tasks for a loan from Taskmaster """

    def __init__(self):
        super().__init__(
            name="get_tasks",
            description="Tool for fetching all borrower tasks for a loan from Taskmaster",
            input_schema={
                "type": "object",
                "properties": {
                    "loan-id": {
                        "type": "string", 
                        "description": "The ID of the loan for which to fetch tasks"
                    },
                    "company": {
                        "type": "string", 
                        "description": "The company associated with the loan"
                    }
                },
                "required": ["loan-id", "company"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Exeucte tasks retrieval
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: loan-id, company"}, indent=2)
        
        domain = os.getenv("TASKMASTER_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "Taskmaster domain not configured. Please set the TASKMASTER_DOMAIN environment variable."},
                indent=2
            )
        
        url = f"{domain}/v1/loans/{arguments['loan-id']}/tasks?include-language-content=true&include-additional-details=true&include-documents=true&include-affirmation-responses=true"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "x-gr-company": arguments["company"]
        }

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return json.dumps({"success": True, "data": response.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to fetch tasks", e, logger=logger)


class RemoveTaskTool(BaseTool):
    """ Tool to remove a specific task from a loan in taskmaster """

    def __init__(self):
        super().__init__(
            name="remove_task",
            description="Tool to remove a specific task from a loan in taskmaster",
            input_schema={
                "type": "object",
                "properties": {
                    "loan-id": {
                        "type": "string", 
                        "description": "The ID of the loan from which to remove the task"
                    },
                    "task-id": {
                        "type": "string", 
                        "description": "The ID of the task to remove"
                    },
                    "company": {
                        "type": "string", 
                        "description": "The company associated with the loan"
                    }
                },
                "required": ["loan-id", "task-id", "company"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute task removal
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: loan-id, task-id, company"}, indent=2)

        domain = os.getenv("TASKMASTER_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "Taskmaster domain not configured. Please set the TASKMASTER_DOMAIN environment variable."},
                indent=2
            )

        url = f"{domain}/v1/loans/{arguments['loan-id']}/tasks/{arguments['task-id']}"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "x-gr-company": arguments["company"]
        }
        body = {
            "source": "managed",
            "task-removed": True
        }

        try:
            response = requests.patch(url, headers=headers, json=body)
            response.raise_for_status()
            return json.dumps({"success": True, "data": response.json()}, indent=2)

        except requests.RequestException as e:
            return sanitized_error("Failed to remove task", e, logger=logger)


class GetConditionTaskTemplatesTool(BaseTool):
    """ Tool to retrieve condition task templates from taskmaster based on the provided conditions """

    def __init__(self):
        super().__init__(
            name="get_condition_task_templates",
            description="Retrieves associated task templates based on the provided conditions",
            input_schema={
                "type": "object",
                "properties": {
                    "conditionKeys": {
                        "type": "array", 
                        "description": "The list of condition keys to retrieve task templates for",
                        "items": {
                            "type": "string"
                        }
                    }
                },
                "required": ["conditionKeys"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute the retrieval of condition task templates
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: conditionKeys"}, indent=2)

        domain = os.getenv("TASKMASTER_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "Taskmaster domain not configured. Please set the TASKMASTER_DOMAIN environment variable."},
                indent=2
            )

        url = f"{domain}/v2/conditions/task-templates/search"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-company": "gri",
            "Authorization": f"Bearer {access_token}"
        }

        try:
            response = requests.post(url, headers=headers, json={"conditionKeys": arguments["conditionKeys"]})
            response.raise_for_status()
            return json.dumps({"success": True, "data": response.json()}, indent=2)

        except requests.RequestException as e:
            return sanitized_error("Failed to retrieve condition task templates", e, logger=logger)