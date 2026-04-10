import smtplib
import glob
import os

def send_multiple_raw_emails():
    """
    @description
    실행되는 스크립트 파일의 절대 경로를 기준으로 동일 디렉토리 내에 존재하는 
    다중 원본 이메일 파일(.eml)을 탐색 및 판독하여 순차 발송하는 자동화 스크립트입니다.
    작업 디렉토리(Current Working Directory)의 위치와 무관하게 스크립트 파일의 위치를 동적으로 참조합니다.
    """
    # SMTP 서버 연결 및 인증 정보 설정 (Authentication Setup)
    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    sender_email = "example@gmail.com"
    sender_password = "password"  # 2단계 인증용 앱 비밀번호
    target_email = "someone@example.com"
    
    # 1. 현재 실행 중인 스크립트 파일(__file__)의 절대 경로(Absolute Path)를 추출합니다.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 2. 추출된 스크립트 디렉토리 경로와 탐색 패턴(*.eml)을 병합합니다.
    search_pattern = os.path.join(script_dir, "*.eml")
    
    # 3. 병합된 경로 패턴을 기반으로 파일 시스템 내 매칭되는 모든 .eml 파일 목록을 반환합니다.
    eml_files = glob.glob(search_pattern)
    
    if not eml_files:
        print(f"경고: 참조된 스크립트 절대 경로({script_dir})에 .eml 파일이 존재하지 않습니다.")
        return

    print(f"총 {len(eml_files)}개의 .eml 파일을 발견했습니다. 순차 발송(Sequential Dispatch)을 시작합니다.\n")

    try:
        # SMTP 서버 세션 초기화 및 TLS(Transport Layer Security) 암호화 연결 수립
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(sender_email, sender_password)
            
            for file_path in eml_files:
                try:
                    # 원본 이메일 파일(.eml)을 바이너리 모드로 판독(Read Binary)하여 무결성 유지
                    with open(file_path, 'rb') as f:
                        raw_email_bytes = f.read()
                        
                    # SMTP 봉투(Envelope) 정보를 재설정하고 원본 데이터(Raw Payload) 전송
                    server.sendmail(sender_email, target_email, raw_email_bytes)
                    print(f"[발송 성공] 파일명: {os.path.basename(file_path)}")
                    
                except Exception as e:
                    print(f"[발송 실패] 파일명: {os.path.basename(file_path)} | Error: {e}")
                    
        print("\n모든 이메일의 일괄 발송 처리가 정상적으로 완료되었습니다.")
        
    except smtplib.SMTPAuthenticationError:
        print("SMTP 인증 실패: 이메일 주소 또는 앱 비밀번호를 다시 확인하십시오.")
    except Exception as e:
        print(f"SMTP 서버 연결 및 처리 중 치명적 오류(Fatal Error) 발생: {e}")

if __name__ == "__main__":
    send_multiple_raw_emails()