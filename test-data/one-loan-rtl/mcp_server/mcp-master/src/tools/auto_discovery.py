"""
Auto-discovery system for tools
Automatically finds and registers tools from tool files
"""

import os
import importlib
import inspect
from typing import List, Type
from .base import BaseTool


def discover_tools() -> List[Type[BaseTool]]:
    """
    Automatically discover all tool classes in the tools directory
    Returns a list of tool classes that inherit from BaseTool
    """
    tools = []
    tools_dir = os.path.dirname(__file__)
    
    # Get all Python files in the tools directory
    for filename in os.listdir(tools_dir):
        if filename.endswith('_tools.py') and filename != '__init__.py':
            module_name = filename[:-3]  # Remove .py extension
            
            try:
                # Import the module
                module = importlib.import_module(f'.{module_name}', package='src.tools')
                
                # Find all classes in the module that inherit from BaseTool
                for name, obj in inspect.getmembers(module, inspect.isclass):
                    if (issubclass(obj, BaseTool) and 
                        obj != BaseTool and 
                        obj.__module__ == module.__name__):
                        tools.append(obj)
                        
            except Exception as e:
                print(f"Warning: Could not import {module_name}: {e}")
                continue
    
    return tools


def get_tool_config_key(tool_class: Type[BaseTool]) -> str:
    """
    Generate configuration key for a tool based on its class name
    Converts CamelCase to snake_case and adds TOOL_ prefix
    """
    # Convert CamelCase to snake_case
    name = tool_class.__name__
    snake_case = ''.join(['_' + c.lower() if c.isupper() and i > 0 else c.lower() 
                         for i, c in enumerate(name)])
    
    # Remove '_tool' suffix if present
    if snake_case.endswith('_tool'):
        snake_case = snake_case[:-5]
    
    return f"TOOL_{snake_case.upper()}_ENABLED"


def create_tool_instance(tool_class: Type[BaseTool]) -> BaseTool:
    """Create an instance of a tool class"""
    return tool_class()
