"""
Request validation and sanitization
"""

import re
import json
import html
from typing import Dict, Any, List, Optional, Union
import logging

logger = logging.getLogger(__name__)


class RequestValidator:
    """Request validation and sanitization"""
    
    def __init__(self):
        self.max_string_length = 100000
        self.max_array_length = 100
        self.max_object_depth = 10
        self.blocked_patterns = [
            r'<script[^>]*>.*?</script>',  # Script tags
            r'javascript:',  # JavaScript URLs
            r'data:text/html',  # Data URLs
            r'vbscript:',  # VBScript
            r'on\w+\s*=',  # Event handlers
        ]
    
    def validate_tool_request(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Validate tool request"""
        errors = []
        
        # Validate tool name
        if not self._is_valid_tool_name(tool_name):
            errors.append(f"Invalid tool name: {tool_name}")
        
        # Validate arguments
        if not isinstance(arguments, dict):
            errors.append("Arguments must be a dictionary")
        else:
            # Sanitize arguments
            sanitized_args = self._sanitize_object(arguments)
            
            # Validate specific tool arguments
            tool_errors = self._validate_tool_specific_args(tool_name, sanitized_args)
            errors.extend(tool_errors)
        
        if errors:
            raise ValueError(f"Validation errors: {'; '.join(errors)}")
        
        return {
            'tool_name': tool_name,
            'arguments': sanitized_args
        }
    
    def _is_valid_tool_name(self, tool_name: str) -> bool:
        """Validate tool name"""
        if not isinstance(tool_name, str):
            return False
        
        # Only allow alphanumeric characters and underscores
        return bool(re.match(r'^[a-zA-Z0-9_]+$', tool_name))
    
    def _validate_tool_specific_args(self, tool_name: str, arguments: Dict[str, Any]) -> List[str]:
        """Validate tool-specific arguments"""
        errors = []
        
        if tool_name == 'credit_check':
            errors.extend(self._validate_credit_check_args(arguments))
        elif tool_name == 'loan_eligibility':
            errors.extend(self._validate_loan_eligibility_args(arguments))
        elif tool_name == 'property_valuation':
            errors.extend(self._validate_property_valuation_args(arguments))
        elif tool_name == 'send_sms':
            errors.extend(self._validate_sms_args(arguments))
        
        return errors
    
    def _validate_credit_check_args(self, args: Dict[str, Any]) -> List[str]:
        """Validate credit check arguments"""
        errors = []
        
        required_fields = ['fullName', 'ssn', 'dateOfBirth']
        for field in required_fields:
            if field not in args:
                errors.append(f"Missing required field: {field}")
        
        if 'fullName' in args and not isinstance(args['fullName'], str):
            errors.append("fullName must be a string")
        
        if 'ssn' in args and not isinstance(args['ssn'], str):
            errors.append("ssn must be a string")
        
        if 'dateOfBirth' in args and not isinstance(args['dateOfBirth'], str):
            errors.append("dateOfBirth must be a string")
        
        return errors
    
    def _validate_loan_eligibility_args(self, args: Dict[str, Any]) -> List[str]:
        """Validate loan eligibility arguments"""
        errors = []
        
        required_fields = ['income', 'creditScore', 'downPayment', 'propertyValue']
        for field in required_fields:
            if field not in args:
                errors.append(f"Missing required field: {field}")
            elif not isinstance(args[field], (int, float)):
                errors.append(f"{field} must be a number")
            elif args[field] < 0:
                errors.append(f"{field} must be positive")
        
        return errors
    
    def _validate_property_valuation_args(self, args: Dict[str, Any]) -> List[str]:
        """Validate property valuation arguments"""
        errors = []
        
        required_fields = ['address', 'propertyType', 'squareFootage']
        for field in required_fields:
            if field not in args:
                errors.append(f"Missing required field: {field}")
        
        if 'address' in args and not isinstance(args['address'], str):
            errors.append("address must be a string")
        
        if 'propertyType' in args and not isinstance(args['propertyType'], str):
            errors.append("propertyType must be a string")
        
        if 'squareFootage' in args and not isinstance(args['squareFootage'], (int, float)):
            errors.append("squareFootage must be a number")
        
        return errors
    
    def _validate_sms_args(self, args: Dict[str, Any]) -> List[str]:
        """Validate SMS arguments"""
        errors = []
        
        required_fields = ['to', 'message']
        for field in required_fields:
            if field not in args:
                errors.append(f"Missing required field: {field}")
            elif not isinstance(args[field], str):
                errors.append(f"{field} must be a string")
        
        if 'to' in args and not self._is_valid_phone_number(args['to']):
            errors.append("Invalid phone number format")
        
        return errors
    
    def _is_valid_phone_number(self, phone: str) -> bool:
        """Validate phone number"""
        # Simple phone number validation
        phone_pattern = r'^\+?[1-9]\d{1,14}$'
        return bool(re.match(phone_pattern, phone.replace(' ', '').replace('-', '')))
    
    def _sanitize_object(self, obj: Any, depth: int = 0) -> Any:
        """Recursively sanitize object"""
        if depth > self.max_object_depth:
            raise ValueError("Object depth exceeds maximum allowed")
        
        if isinstance(obj, bytes):
            # Pass through bytes unchanged (for file uploads)
            return obj
        elif isinstance(obj, str):
            return self._sanitize_string(obj)
        elif isinstance(obj, list):
            if len(obj) > self.max_array_length:
                raise ValueError("Array length exceeds maximum allowed")
            return [self._sanitize_object(item, depth + 1) for item in obj]
        elif isinstance(obj, dict):
            return {k: self._sanitize_object(v, depth + 1) for k, v in obj.items()}
        elif isinstance(obj, (int, float, bool, type(None))):
            return obj
        else:
            # Convert other types to string and sanitize
            return self._sanitize_string(str(obj))
    
    def _sanitize_string(self, text: str) -> str:
        """Sanitize string input"""
        if not isinstance(text, str):
            text = str(text)
        
        if len(text) > self.max_string_length:
            text = text[:self.max_string_length]
        
        # HTML escape
        text = html.escape(text)
        
        # Remove blocked patterns
        for pattern in self.blocked_patterns:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.DOTALL)
        
        # Remove null bytes
        text = text.replace('\x00', '')
        
        return text
    
    def validate_json_rpc_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Validate JSON-RPC request"""
        errors = []
        
        # Check required fields
        if 'jsonrpc' not in request:
            errors.append("Missing jsonrpc field")
        elif request['jsonrpc'] != '2.0':
            errors.append("Invalid jsonrpc version")
        
        if 'method' not in request:
            errors.append("Missing method field")
        elif not isinstance(request['method'], str):
            errors.append("Method must be a string")
        
        if 'id' not in request:
            errors.append("Missing id field")
        
        # Validate method
        if 'method' in request:
            method = request['method']
            if method not in ['tools/list', 'tools/call']:
                errors.append(f"Unsupported method: {method}")
        
        # Validate params for tools/call
        if request.get('method') == 'tools/call':
            if 'params' not in request:
                errors.append("Missing params for tools/call")
            elif not isinstance(request['params'], dict):
                errors.append("Params must be a dictionary")
            else:
                params = request['params']
                if 'name' not in params:
                    errors.append("Missing tool name in params")
                if 'arguments' not in params:
                    errors.append("Missing arguments in params")
        
        if errors:
            raise ValueError(f"JSON-RPC validation errors: {'; '.join(errors)}")
        
        return request
